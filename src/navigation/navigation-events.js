import { reroute } from "./reroute.js";
import { find } from "../utils/find.js";
import { formatErrorMessage } from "../applications/app-errors.js";
import { isInBrowser } from "../utils/runtime-environment.js";
import { isStarted } from "../start.js";

/* We capture navigation event listeners so that we can make sure
 * that application navigation listeners are not called until
 * single-spa has ensured that the correct applications are
 * unmounted and mounted.
 */
const capturedEventListeners = {
  hashchange: [],
  popstate: [],
};

export const routingEventsListeningTo = ["hashchange", "popstate"];

// 跳转路由
export function navigateToUrl(obj) {
  let url;
  if (typeof obj === "string") {
    url = obj;
  } else if (this && this.href) {
    url = this.href;
  } else if ( // obj 以事件的形式传入
    obj &&
    obj.currentTarget &&
    obj.currentTarget.href &&
    obj.preventDefault
  ) {
    url = obj.currentTarget.href;
    obj.preventDefault();
  } else {
    throw Error(
      formatErrorMessage(
        14,
        __DEV__ &&
          `singleSpaNavigate/navigateToUrl must be either called with a string url, with an <a> tag as its context, or with an event whose currentTarget is an <a> tag`
      )
    );
  }

  // 根据给定路由地址创建 a 标签
  const current = parseUri(window.location.href);
  const destination = parseUri(url);

  if (url.indexOf("#") === 0) { // hash 形式的 url
    window.location.hash = destination.hash;
  } else if (current.host !== destination.host && destination.host) {
    // 域名端口不同，直接跳转到 url
    if (process.env.BABEL_ENV === "test") {
      return { wouldHaveReloadedThePage: true };
    } else {
      window.location.href = url;
    }
  } else if (
    // 两者 url 完全相同
    destination.pathname === current.pathname &&
    destination.search === current.search
  ) {
    window.location.hash = destination.hash;
  } else {
    // 不是 hash 路由，两者 host 相同，但 pathname 或 search 不相同时，直接调用 pushState
    // different path, host, or query params
    window.history.pushState(null, null, url);
  }
}

export function callCapturedEventListeners(eventArguments) {
  if (eventArguments) {
    const eventType = eventArguments[0].type;
    if (routingEventsListeningTo.indexOf(eventType) >= 0) {
      capturedEventListeners[eventType].forEach((listener) => {
        try {
          // The error thrown by application event listener should not break single-spa down.
          // Just like https://github.com/single-spa/single-spa/blob/85f5042dff960e40936f3a5069d56fc9477fac04/src/navigation/reroute.js#L140-L146 did
          listener.apply(this, eventArguments);
        } catch (e) {
          setTimeout(() => {
            throw e;
          });
        }
      });
    }
  }
}

let urlRerouteOnly;

export function setUrlRerouteOnly(val) {
  urlRerouteOnly = val;
}

// 调用 reroute
function urlReroute() {
  reroute([], arguments);
}

/**
 * 改写 pushState、replaceState 方法
 * @param {window.history.pushState | window.history.replaceState} updateState 
 * @param {'pushState', 'replaceState'} methodName 
 * @returns 
 */
function patchedUpdateState(updateState, methodName) {
  return function () {
    const urlBefore = window.location.href; // 触发前的 url
    const result = updateState.apply(this, arguments); // 调用原生 pushState 或 replaceState 事件
    const urlAfter = window.location.href; // 触发后的 url

    // 如果设置了 start({ urlRerouteOnly: true }) 或跳转前后路由相同，则不会触发这段逻辑
    if (!urlRerouteOnly || urlBefore !== urlAfter) {
      if (isStarted()) {
        // fire an artificial popstate event once single-spa is started,
        // so that single-spa applications know about routing that
        // occurs in a different application
        window.dispatchEvent(
          createPopStateEvent(window.history.state, methodName)
        );
      } else {
        // do not fire an artificial popstate event before single-spa is started,
        // since no single-spa applications need to know about routing events
        // outside of their own router.
        reroute([]);
      }
    }

    return result;
  };
}

function createPopStateEvent(state, originalMethodName) {
  // https://github.com/single-spa/single-spa/issues/224 and https://github.com/single-spa/single-spa-angular/issues/49
  // We need a popstate event even though the browser doesn't do one by default when you call replaceState, so that
  // all the applications can reroute. We explicitly identify this extraneous event by setting singleSpa=true and
  // singleSpaTrigger=<pushState|replaceState> on the event instance.
  let evt;
  try {
    evt = new PopStateEvent("popstate", { state });
  } catch (err) {
    // IE 11 compatibility https://github.com/single-spa/single-spa/issues/299
    // https://docs.microsoft.com/en-us/openspecs/ie_standards/ms-html5e/bd560f47-b349-4d2c-baa8-f1560fb489dd
    evt = document.createEvent("PopStateEvent");
    evt.initPopStateEvent("popstate", false, false, state);
  }
  evt.singleSpa = true;
  evt.singleSpaTrigger = originalMethodName;
  return evt;
}

if (isInBrowser) {
  // We will trigger an app change for any routing events.
  // hashchange 或 popstate 的触发会调用 reroute 事件
  window.addEventListener("hashchange", urlReroute);
  window.addEventListener("popstate", urlReroute);

  // Monkeypatch addEventListener so that we can ensure correct timing
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;
  window.addEventListener = function (eventName, fn) {
    if (typeof fn === "function") {
      if (
        routingEventsListeningTo.indexOf(eventName) >= 0 &&
        !find(capturedEventListeners[eventName], (listener) => listener === fn)
      ) {
        capturedEventListeners[eventName].push(fn);
        return;
      }
    }

    return originalAddEventListener.apply(this, arguments);
  };

  window.removeEventListener = function (eventName, listenerFn) {
    if (typeof listenerFn === "function") {
      if (routingEventsListeningTo.indexOf(eventName) >= 0) {
        capturedEventListeners[eventName] = capturedEventListeners[
          eventName
        ].filter((fn) => fn !== listenerFn);
        return;
      }
    }

    return originalRemoveEventListener.apply(this, arguments);
  };

  // 加强 pushState 和 replaceState
  window.history.pushState = patchedUpdateState(
    window.history.pushState,
    "pushState"
  );
  window.history.replaceState = patchedUpdateState(
    window.history.replaceState,
    "replaceState"
  );

  // 防止用户引入两次 single-spa，不过一般没人会这样做吧
  if (window.singleSpaNavigate) {
    console.warn(
      formatErrorMessage(
        41,
        __DEV__ &&
          "single-spa has been loaded twice on the page. This can result in unexpected behavior."
      )
    );
  } else {
    /* For convenience in `onclick` attributes, we expose a global function for navigating to
     * whatever an <a> tag's href is.
     */
    // window.singleSpaNavigate 提供给用户手动跳转路由，
    // 该属性也可以作为判断微应用的环境是独立运行还是 single-spa 运行的依据
    window.singleSpaNavigate = navigateToUrl;
  }
}

// 根据给定路由地址创建 a 标签
function parseUri(str) {
  const anchor = document.createElement("a");
  anchor.href = str;
  return anchor;
}
