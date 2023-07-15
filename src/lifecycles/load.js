import {
  LOAD_ERROR,
  NOT_BOOTSTRAPPED,
  LOADING_SOURCE_CODE,
  SKIP_BECAUSE_BROKEN,
  NOT_LOADED,
  objectType,
  toName,
} from "../applications/app.helpers.js";
import { ensureValidAppTimeouts } from "../applications/timeouts.js";
import {
  handleAppError,
  formatErrorMessage,
} from "../applications/app-errors.js";
import {
  flattenFnArray,
  smellsLikeAPromise,
  validLifecycleFn,
} from "./lifecycle.helpers.js";
import { getProps } from "./prop.helpers.js";
import { assign } from "../utils/assign.js";

/**
 * 加载微应用，把微应用状态设置为 LOADING_SOURCE_CODE
 * 调用 app.loadApp，把 props 作为 loadApp 的参数传入，使用户进一步处理 props，根据返回结果配置微应用生命周期
 * 如果加载成功把微应用状态设置为 NOT_BOOTSTRAPPED
 * 如果加载失败把微应用状态设置为 SKIP_BECAUSE_BROKEN 或 LOAD_ERROR
 * @param {*} app 微应用
 * @returns {Promise<app | loadPromise>}
 */
export function toLoadPromise(app) {
  return Promise.resolve().then(() => {
    if (app.loadPromise) {
      return app.loadPromise;
    }

    // 如果已加载，返回 app
    if (app.status !== NOT_LOADED && app.status !== LOAD_ERROR) {
      return app;
    }

    app.status = LOADING_SOURCE_CODE; // 状态变为加载源代码中

    // isUserErr 是否为用户定义的 loadApp 方法未返回带有生命周期对象的 Promise 实例导致的错误
    let appOpts, isUserErr;

    // 有点毁掉地狱的感觉，但最终返回 app
    return (app.loadPromise = Promise.resolve()
      .then(() => {
        // 执行微应用 loadApp 方法，应返回的是带有生命周期对象的 Promise 实例
        const loadPromise = app.loadApp(getProps(app));
        // 判断传入的 promise 是否为 promise 实例，不是 promise 实例的话抛出错误
        if (!smellsLikeAPromise(loadPromise)) {
          // The name of the app will be prepended to this error message inside of the handleAppError function
          isUserErr = true;
          throw Error(
            formatErrorMessage(
              33,
              __DEV__ &&
                `single-spa loading function did not return a promise. Check the second argument to registerApplication('${toName(
                  app
                )}', loadingFunction, activityFunction)`,
              toName(app)
            )
          );
        }
        return loadPromise.then((val) => { // 以下逻辑为检验 val 生命周期是否符合规则，并初始化一些 app 配置项
          app.loadErrorTime = null; // 微应用加载成功，清空加载错误的时间

          appOpts = val;

          // 错误信息和错误代码
          let validationErrMessage, validationErrCode;

          if (typeof appOpts !== "object") {
            validationErrCode = 34;
            if (__DEV__) {
              validationErrMessage = `does not export anything`;
            }
          }

          // 判断 bootstrap 是否为 Function 或 Array<Function>
          if (
            // ES Modules don't have the Object prototype
            Object.prototype.hasOwnProperty.call(appOpts, "bootstrap") &&
            !validLifecycleFn(appOpts.bootstrap)
          ) {
            validationErrCode = 35;
            if (__DEV__) {
              validationErrMessage = `does not export a valid bootstrap function or array of functions`;
            }
          }
          // 判断 mount 是否为 Function 或 Array<Function>
          if (!validLifecycleFn(appOpts.mount)) {
            validationErrCode = 36;
            if (__DEV__) {
              validationErrMessage = `does not export a mount function or array of functions`;
            }
          }
          // 判断 unmount 是否为 Function 或 Array<Function>
          if (!validLifecycleFn(appOpts.unmount)) {
            validationErrCode = 37;
            if (__DEV__) {
              validationErrMessage = `does not export a unmount function or array of functions`;
            }
          }

          const type = objectType(appOpts);

          // 如果 loadPromise 返回的结果有误，则抛出错误
          if (validationErrCode) {
            let appOptsStr;
            try {
              appOptsStr = JSON.stringify(appOpts);
            } catch {}
            console.error(
              formatErrorMessage(
                validationErrCode,
                __DEV__ &&
                  `The loading function for single-spa ${type} '${toName(
                    app
                  )}' resolved with the following, which does not have bootstrap, mount, and unmount functions`,
                type,
                toName(app),
                appOptsStr
              ),
              appOpts
            );
            handleAppError(validationErrMessage, app, SKIP_BECAUSE_BROKEN);
            return app;
          }

          if (appOpts.devtools && appOpts.devtools.overlays) {
            app.devtools.overlays = assign(
              {},
              app.devtools.overlays,
              appOpts.devtools.overlays
            );
          }

          app.status = NOT_BOOTSTRAPPED; // 状态切换为未准备
          // 扁平化生命周期方法或数组
          app.bootstrap = flattenFnArray(appOpts, "bootstrap");
          app.mount = flattenFnArray(appOpts, "mount");
          app.unmount = flattenFnArray(appOpts, "unmount");
          app.unload = flattenFnArray(appOpts, "unload");
          // 设置超时配置
          app.timeouts = ensureValidAppTimeouts(appOpts.timeouts);
          // 加载完毕，清除对 loadPromise 的缓存
          delete app.loadPromise;

          return app;
        });
      })
      // loadPromise 遇到错误
      .catch((err) => {
        delete app.loadPromise; // 删除 loadPromise 缓存

        let newStatus;
        if (isUserErr) { // 如果是用户导致的错误，把微应用标记为死亡状态
          newStatus = SKIP_BECAUSE_BROKEN;
        } else { // 否则标记为加载失败，并设置当前时间为加载失败时间
          newStatus = LOAD_ERROR;
          app.loadErrorTime = new Date().getTime();
        }
        handleAppError(err, app, newStatus);

        return app;
      }));
  });
}
