import {
  NOT_MOUNTED,
  MOUNTED,
  SKIP_BECAUSE_BROKEN,
} from "../applications/app.helpers.js";
import { handleAppError, transformErr } from "../applications/app-errors.js";
import { reasonableTime } from "../applications/timeouts.js";
import CustomEvent from "custom-event";
import { toUnmountPromise } from "./unmount.js";

let beforeFirstMountFired = false; // 是否为第一次挂载之前
let firstMountFired = false; // 是否为第一次挂载

/**
 * 挂载当前微应用
 * 如果是第一次挂载之前，调用 single-spa:before-first-mount 事件
 * 状态变更为已挂载，调用 mount 生命周期钩子
 * 成功，状态变更为已挂载，如果是第一次挂载，调用 single-spa:first-mount 事件
 * 失败，状态变更为已挂载，方便 toUnmountPromise 卸载它，并把状态变更为 SKIP_BECAUSE_BROKEN
 * @param {*} appOrParcel 微应用
 * @param {*} hardFail 
 * @returns 
 */
export function toMountPromise(appOrParcel, hardFail) {
  return Promise.resolve().then(() => {
    // 如果微应用状态不是未挂载，直接返回
    if (appOrParcel.status !== NOT_MOUNTED) {
      return appOrParcel;
    }

    if (!beforeFirstMountFired) { // 如果是第一次挂载之前，发布 single-spa:before-first-mount 事件
      window.dispatchEvent(new CustomEvent("single-spa:before-first-mount"));
      beforeFirstMountFired = true;
    }

    // 调用 mount 生命周期钩子
    return reasonableTime(appOrParcel, "mount")
      .then(() => {
        appOrParcel.status = MOUNTED; // 状态变更为已挂载

        if (!firstMountFired) { // 如果是第一次挂载，发布 single-spa:first-mount 事件
          window.dispatchEvent(new CustomEvent("single-spa:first-mount"));
          firstMountFired = true;
        }

        return appOrParcel;
      })
      .catch((err) => {
        // If we fail to mount the appOrParcel, we should attempt to unmount it before putting in SKIP_BECAUSE_BROKEN
        // We temporarily put the appOrParcel into MOUNTED status so that toUnmountPromise actually attempts to unmount it
        // instead of just doing a no-op.
        appOrParcel.status = MOUNTED;
        return toUnmountPromise(appOrParcel, true).then(
          setSkipBecauseBroken,
          setSkipBecauseBroken
        );

        function setSkipBecauseBroken() {
          if (!hardFail) {
            handleAppError(err, appOrParcel, SKIP_BECAUSE_BROKEN);
            return appOrParcel;
          } else {
            throw transformErr(err, appOrParcel, SKIP_BECAUSE_BROKEN);
          }
        }
      });
  });
}
