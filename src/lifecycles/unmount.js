import {
  UNMOUNTING,
  NOT_MOUNTED,
  MOUNTED,
  SKIP_BECAUSE_BROKEN,
} from "../applications/app.helpers.js";
import { handleAppError, transformErr } from "../applications/app-errors.js";
import { reasonableTime } from "../applications/timeouts.js";

/**
 * 卸载微应用，微应用状态变更为 UNMOUNTING
 * 调用 unmount 生命周期函数
 * 如果成功状态变更为 NOT_MOUNTED
 * 如果失败状态变更为 SKIP_BECAUSE_BROKEN
 * @param {*} appOrParcel 
 * @param {*} hardFail 
 * @returns 
 */
export function toUnmountPromise(appOrParcel, hardFail) {
  return Promise.resolve().then(() => {
    // 如果微应用状态不为 MOUNTED，返回
    if (appOrParcel.status !== MOUNTED) {
      return appOrParcel;
    }
    appOrParcel.status = UNMOUNTING; // 微应用状态改为卸载中

    const unmountChildrenParcels = Object.keys(
      appOrParcel.parcels
    ).map((parcelId) => appOrParcel.parcels[parcelId].unmountThisParcel());

    let parcelError;

    return Promise.all(unmountChildrenParcels)
      // .then(resolve, reject)
      .then(unmountAppOrParcel, (parcelError) => {
        // There is a parcel unmount error
        return unmountAppOrParcel().then(() => {
          // Unmounting the app/parcel succeeded, but unmounting its children parcels did not
          const parentError = Error(parcelError.message);
          if (hardFail) {
            throw transformErr(parentError, appOrParcel, SKIP_BECAUSE_BROKEN);
          } else {
            handleAppError(parentError, appOrParcel, SKIP_BECAUSE_BROKEN);
          }
        });
      })
      .then(() => appOrParcel);

    // 调用 unmount 生命周期函数
    function unmountAppOrParcel() {
      // We always try to unmount the appOrParcel, even if the children parcels failed to unmount.
      // 调用 unmount 生命周期函数
      return reasonableTime(appOrParcel, "unmount")
        .then(() => {
          // The appOrParcel needs to stay in a broken status if its children parcels fail to unmount
          if (!parcelError) { // 微应用卸载成功，状态变更为未挂载
            appOrParcel.status = NOT_MOUNTED;
          }
        })
        .catch((err) => { // 微应用写在失败，状态变更为死亡
          if (hardFail) {
            throw transformErr(err, appOrParcel, SKIP_BECAUSE_BROKEN);
          } else {
            handleAppError(err, appOrParcel, SKIP_BECAUSE_BROKEN);
          }
        });
    }
  });
}
