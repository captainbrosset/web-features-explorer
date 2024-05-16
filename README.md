# web-features explorer

A set of web pages to visualize the data that's maintained in the [web-platform-dx/web-features](https://github.com/web-platform-dx/web-features/) repository.

Open the website: https://captainbrosset.github.io/web-features-explorer/

## Architecture

The project is a static site that uses [11ty](https://www.11ty.dev/) to generate the pages from the web-features repo data.

The data is retrieved from the web-features repo using the [web-features](https://www.npmjs.com/package/web-features) npm package, by using the **next** version.

In addition, the [browser-compat-data](https://www.npmjs.com/package/browser-compat-data) npm package is used to get links to MDN docs and bug trackers.

## Build

1. Clone the repo locally

1. Run `npm install`

1. Run `npm run build` to generate the site
   
   You can also run `npm run serve` to start a local server and watch for changes

## Bump dependencies

To ensure you have the latest data:

1. Run `npx npm-check-updates -u`

1. Run `npm update web-features`
