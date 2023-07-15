import { handleAppError } from "./app-errors.js";

// App statuses
export const NOT_LOADED = "NOT_LOADED"; // 未加载
export const LOADING_SOURCE_CODE = "LOADING_SOURCE_CODE"; // 加载源代码中
export const NOT_BOOTSTRAPPED = "NOT_BOOTSTRAPPED"; // 未初始化
export const BOOTSTRAPPING = "BOOTSTRAPPING"; // 初始化中
export const NOT_MOUNTED = "NOT_MOUNTED"; // 未挂载
export const MOUNTING = "MOUNTING"; // 挂载中
export const MOUNTED = "MOUNTED"; // 已挂载
export const UPDATING = "UPDATING";
export const UNMOUNTING = "UNMOUNTING"; // 卸载中
export const UNLOADING = "UNLOADING"; // 移除中
export const LOAD_ERROR = "LOAD_ERROR"; // 加载失败
export const SKIP_BECAUSE_BROKEN = "SKIP_BECAUSE_BROKEN"; // 意外死亡

export function isActive(app) {
  return app.status === MOUNTED;
}

/**
 * 判断微应用是否活跃
 */
export function shouldBeActive(app) {
  try {
    return app.activeWhen(window.location);
  } catch (err) {
    handleAppError(err, app, SKIP_BECAUSE_BROKEN);
    return false;
  }
}

export function toName(app) {
  return app.name;
}

export function isParcel(appOrParcel) {
  return Boolean(appOrParcel.unmountThisParcel);
}
// 判断 appOrParcel 是一个包还是微应用
export function objectType(appOrParcel) {
  return isParcel(appOrParcel) ? "parcel" : "application";
}
