const glob = require('glob')
const isGlob = require('is-glob')
const path = require('path')

module.exports = function importGlobArrayPlugin(babel) {
  const { types: t } = babel
  return {
    visitor: {
      ImportDeclaration(_path, state) {
        const importPath = _path.node.source.value
        const currentFilePath = state.file.opts.filename
        const baseDir = path.resolve(path.dirname(currentFilePath))

        // If this is not a local require, don't do anything
        if (importPath[0] !== '.' && importPath[0] !== '/') return

        // If the import specifier doesn't contain a glob pattern, don't do anything
        if (!isGlob(importPath)) return

        // if no filename was provided, we can't get directory contents
        if (!currentFilePath || currentFilePath === 'unknown') {
          throw new Error(
            'You must provide a filename to babel in order to be able to use the directory import plugin'
          )
        }

        // run the glob to determine which files we need to import
        const files = glob.sync(
          path.join(baseDir, importPath),
          state.opts.globOptions
        )

        // format them so they are relative to the current file
        const filesRelative = files.map(file => `.${file.replace(baseDir, '')}`)

        // First we go through the right side of the import and expand the single wildcard to multiple
        // individual imports. In the process, we assign a placeholder variable name to each import.
        // Later, we will put the placeholders in an array and assign that to the actual name.
        const namePlaceholderMap = {}
        const importStatements = filesRelative.map(filePath => {
          // Now let's go through the left side of the import statement, known as "specifiers" to babel.
          // In this section we will see one or more import specifiers. For example, we might see
          // something like "import x", which would be a single specifier, or "import x, { y as z }",
          // which would be an array of two specifiers.
          const specifiers = _path.node.specifiers.map(specifier => {
            // First we'll set up a placeholder for the import. Later on we will rename it to the
            // intended name, for now we need to prevent conflicts.
            const placeholder = _path.scope.generateUid('_iga')

            // Import specifiers can have two names, a local and imported name.
            // The local name represents what the import is actually named within your javacript file.
            // So for example, with "import x", the local name is "x". With "import { x as y }" the local
            // name is "y". In this example, "x" is referred to as the imported name.
            const name = specifier.local.name

            // Now we need to associate the local name "x" with the placeholder we're
            // about to replace it with, so that later we can create x = [_iga1, _iga2, ...etc]
            if (!namePlaceholderMap[name]) namePlaceholderMap[name] = []
            namePlaceholderMap[name].push(placeholder)

            // There are three types of import specifiers we could be dealing with here. Depending on
            // which type, we need to slightly modify the output.
            if (t.isImportDefaultSpecifier(specifier)) {
              // An "import default specifier" could be for example: "import x"
              // This needs to be transformed into "import _iga1"
              return t.importDefaultSpecifier(t.identifier(placeholder))
            } else if (t.isImportSpecifier(specifier)) {
              // Next, an "import specifier" could be for example: "import { x as y }"
              // This needs to be transformed into "import { x as _iga1 }"
              return t.importSpecifier(
                t.identifier(placeholder),
                t.identifier(specifier.imported.name)
              )
            } else if (t.isImportNamespaceSpecifier(specifier)) {
              // An "import namespace specifier" could be for example: "import * as x"
              // This needs to be transformed into "import * as _iga1"
              return t.importNamespaceSpecifier(t.identifier(placeholder))
            } else {
              // At the time of writing, these three are the only import specifiers that can be used
              // If something else is here, it's either a huge bug, or a new addition to es6 imports
              throw new Error(
                `Unrecognized import specifier: ${specifier.type}`
              )
            }
          }, [])

          // With all of that out of the way, let's format our new import statement. On the left, we have
          // our new specifiers modified with placeholders, and on the right, our glob-resolved path, like
          // import _iga1, {metadata as _iga2} from './some/file1'
          return t.importDeclaration(specifiers, t.stringLiteral(filePath))
        })

        // Final step! Now we need to re-associate the original variable names with all the placeholders.
        // Luckily, we have been keeping track of this, so we can use the namePlaceholderMap to quickly
        // write out new variable statements that look something like this:
        // const x = [_iga1, _iga2]
        const varRemappings = []
        for (let k in namePlaceholderMap) {
          varRemappings.push(
            t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier(k),
                t.arrayExpression(
                  namePlaceholderMap[k].map(i => t.stringLiteral(i))
                )
              )
            ])
          )
        }

        // and now we replace the original code with our new code!
        _path.replaceWithMultiple([...importStatements, ...varRemappings])
      }
    }
  }
}
