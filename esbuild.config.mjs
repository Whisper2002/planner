import esbuild from '../node_modules/esbuild/lib/main.js';
await esbuild.build({ entryPoints: ['src/app.js'], bundle: true, format: 'esm', platform: 'browser', target: ['safari17'], outdir: 'site', entryNames: 'app', assetNames: 'assets/[name]-[hash]', loader: { '.json': 'json' }, minify: true, sourcemap: false });
