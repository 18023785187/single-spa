import * as singleSpa from "../single-spa.js";
import { mountParcel } from "../parcels/mount-parcel.js";
import { assign } from "../utils/assign.js";
import { isParcel, toName } from "../applications/app.helpers.js";
import { formatErrorMessage } from "../applications/app-errors.js";

/**
 * 获取微应用或包的 props 整合对象
 */
export function getProps(appOrParcel) {
  const name = toName(appOrParcel); // 获取应用名称
  let customProps = // 获取 customProps
    typeof appOrParcel.customProps === "function"
      ? appOrParcel.customProps(name, window.location)
      : appOrParcel.customProps;
  // 如果 customProps 不是一个对象，那么把 customProps 置为空对象，并抛出警告
  if (
    typeof customProps !== "object" ||
    customProps === null ||
    Array.isArray(customProps)
  ) {
    customProps = {};
    console.warn(
      formatErrorMessage(
        40,
        __DEV__ &&
          `single-spa: ${name}'s customProps function must return an object. Received ${customProps}`
      ),
      name,
      customProps
    );
  }
  // 创建传递给微应用的 props，由 customProps 和内置对象构成
  const result = assign({}, customProps, {
    name, // 微应用名称
    mountParcel: mountParcel.bind(appOrParcel),
    singleSpa, // single-spa，传递该包的目的是为了使微应用不用重复导入包
  });

  if (isParcel(appOrParcel)) {
    result.unmountSelf = appOrParcel.unmountThisParcel;
  }

  return result;
}
