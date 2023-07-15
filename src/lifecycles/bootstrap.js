import {
  NOT_BOOTSTRAPPED,
  BOOTSTRAPPING,
  NOT_MOUNTED,
  SKIP_BECAUSE_BROKEN,
} from "../applications/app.helpers.js";
import { reasonableTime } from "../applications/timeouts.js";
import { handleAppError, transformErr } from "../applications/app-errors.js";

/**
 * 初始化微应用，状态变更为 BOOTSTRAPPING
 * 调用 bootstrap 生命周期钩子
 * 如果成功状态变为 NOT_MOUNTED
 * 如果失败状态变为 SKIP_BECAUSE_BROKEN
 * @param {*} appOrParcel 
 * @param {*} hardFail 
 * @returns 
 */
export function toBootstrapPromise(appOrParcel, hardFail) {
  return Promise.resolve().then(() => {
    // 如果微应用状态不是未初始化，直接返回
    if (appOrParcel.status !== NOT_BOOTSTRAPPED) {
      return appOrParcel;
    }

    appOrParcel.status = BOOTSTRAPPING; // 状态变更为初始化中

    if (!appOrParcel.bootstrap) {
      // Default implementation of bootstrap
      return Promise.resolve().then(successfulBootstrap);
    }

    // 调用 bootstrap 生命周期钩子
    return reasonableTime(appOrParcel, "bootstrap")
      .then(successfulBootstrap)
      .catch((err) => {
        if (hardFail) {
          throw transformErr(err, appOrParcel, SKIP_BECAUSE_BROKEN);
        } else {
          handleAppError(err, appOrParcel, SKIP_BECAUSE_BROKEN);
          return appOrParcel;
        }
      });
  });

  // 成功初始化后的执行函数，把状态变更为未挂载
  function successfulBootstrap() {
    appOrParcel.status = NOT_MOUNTED;
    return appOrParcel;
  }
}
