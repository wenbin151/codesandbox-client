// @flow
import { join, absolute } from 'common/utils/path';
import Preset from '../';

import angular2Transpiler from '../../transpilers/angular2-template';
import typescriptTranspiler from '../../transpilers/typescript';
import babelTranspiler from '../../transpilers/babel';
import jsonTranspiler from '../../transpilers/json';
import stylesTranspiler from '../../transpilers/style';
import sassTranspiler from '../../transpilers/sass';
import rawTranspiler from '../../transpilers/raw';
import stylusTranspiler from '../../transpilers/stylus';
import lessTranspiler from '../../transpilers/less';

let polyfillsLoaded = false;

export default function initialize() {
  const preset = new Preset(
    'angular-cli',
    ['web.ts', 'ts', 'json', 'web.tsx', 'tsx', 'js'],
    {},
    {
      setup: async manager => {
        const { parsed } = manager.configurations['angular-cli'];
        if (!polyfillsLoaded) {
          const zone = manager.resolveModule('zone.js', '/');
          await manager.transpileModules(zone);
          manager.evaluateModule(zone);

          if (parsed.apps && parsed.apps[0]) {
            const app = parsed.apps[0];

            if (app.root && app.polyfills) {
              const polyfillLocation = absolute(join(app.root, app.polyfills));
              const polyfills = manager.resolveModule(polyfillLocation, '/');

              await manager.transpileModules(polyfills);
              manager.evaluateModule(polyfills);
            }
          }

          polyfillsLoaded = true;
        }

        if (parsed.apps && parsed.apps[0]) {
          const app = parsed.apps[0];

          const { styles = [], scripts = [] } = app;

          await Promise.all(
            [...styles, ...scripts].map(async p => {
              const finalPath = absolute(join(app.root || 'src', p));

              const module = manager.resolveModule(finalPath, '/');
              await manager.transpileModules(module);
              manager.evaluateModule(module);
            })
          );

          if (
            app.environmentSource &&
            app.environments &&
            app.environments.dev
          ) {
            manager.preset.setAdditionalAliases({
              [app.environmentSource]: app.environments.dev,
            });
          }
        }
      },
    }
  );

  const sassWithConfig = {
    transpiler: sassTranspiler,
    options: {},
  };

  const lessWithConfig = {
    transpiler: lessTranspiler,
    options: {},
  };

  const stylusWithConfig = {
    transpiler: stylusTranspiler,
    options: {},
  };
  const styles = {
    css: [],
    scss: [sassWithConfig],
    sass: [sassWithConfig],
    less: [lessWithConfig],
    styl: [stylusWithConfig],
  };

  /**
   * Registers transpilers for all different combinations
   *
   * @returns
   */
  function registerStyleTranspilers() {
    return Object.keys(styles).forEach(type => {
      preset.registerTranspiler(
        module => new RegExp(`\\.${type}`).test(module.path),
        [...styles[type], { transpiler: stylesTranspiler }]
      );
    });
  }

  registerStyleTranspilers();

  preset.registerTranspiler(module => /\.tsx?$/.test(module.path), [
    { transpiler: angular2Transpiler, options: { preTranspilers: styles } },
    { transpiler: typescriptTranspiler },
  ]);

  preset.registerTranspiler(module => /\.js$/.test(module.path), [
    { transpiler: babelTranspiler },
  ]);

  preset.registerTranspiler(module => /\.json$/.test(module.path), [
    { transpiler: jsonTranspiler },
  ]);

  preset.registerTranspiler(() => true, [{ transpiler: rawTranspiler }]);

  return preset;
}
