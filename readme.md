# Babel Plugin Import Glob Array

A small, simple babel plugin that will convert any import path containing a glob pattern as an array of each of the fles that match the pattern. It can also import only specific exports from each file, which is useful for a set of files with multiple exports that you need to tree shake.

This plugin is similar to [babel-plugin-import-glob](https://github.com/novemberborn/babel-plugin-import-glob) and [babel-plugin-wildcard](https://github.com/vihanb/babel-plugin-wildcard/blob/master/src/index.js), but with a couple significant differences: it simply imports into an array and does not attempt to determine imports names based off filenames, and it has the capability to import only specific exports from each imported module.

## Installation

First, install via npm:

```sh
npm i babel-plugin-import-glob-array
```

Then just add it to your babel config as a plugin:

```js
plugins: ['import-glob-array']
```

## Usage

This package uses [is-glob](https://github.com/micromatch/is-glob) to detect whether a given import contains a glob pattern. If it does, it will convert the import to individual imports. For example, if you have the following import:

```js
import pages from './pages/*'
```

It would be converted to something like:

```js
import _iga from './pages/page1'
import _iga1 from './pages/page2'

let pages = [_iga, _iga1]
```

And if you only need a specific export, this can be accomplished as such:

```js
import { authorData as pagesAuthors } from './pages/*'
```

Which would be converted as such:

```js
import { authorData as _iga } from './pages/page1'
import { authorData as _iga1 } from './pages/page2'

let pagesAuthors = [_iga, _iga1]
```

You can import multiple exports as well and it will turn out as expected. You can also use the full power of [minimatch](https://github.com/isaacs/minimatch) in your import statements - this example is a simple glob but don't let that deter you from getting a bit more involved.

### Adding Import Metadata

Sometimes it is important to know some information about where the file came from and what it was called in addition to simply the values that were exported. If this is the case, you can import the special property `_importMeta` to get access to this information. For example:

```js
import { default as pages, _importMeta as metadata } from './pages/*'
```

Would be converted as such:

```js
import _iga from './pages/page1'
import _iga1 from './pages/page2'

let pages = [_iga, _iga1]
let metadata = [
  {
    absolutePath: '/Users/example/project/pages/page1.js',
    importedPath: './pages/page1'
  },
  {
    absolutePath: '/Users/example/project/pages/page2.js',
    importedPath: './pages/page1'
  }
]
```

And of course if you need to map actual imports to their meta, the array indices will match exactly so you can do it like this:

```js
import pages, { _importMeta as metadata } from './pages/*'

pages.map((page, idx) => {
  console.log(`export: ${page}, metadata: ${metadata[idx]}`)
})
```

At the moment, the metadata contains only the file path, but I am open to suggestions on other useful things that could be added.
