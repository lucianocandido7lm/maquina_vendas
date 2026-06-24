"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [5564],
  {
    861: (e, t, n) => {
      n.d(t, { Qg: () => a, bL: () => u, s6: () => l });
      var r = n(12115),
        o = n(97602),
        i = n(95155),
        a = Object.freeze({
          position: "absolute",
          border: 0,
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          wordWrap: "normal",
        }),
        l = r.forwardRef((e, t) =>
          (0, i.jsx)(o.sG.span, { ...e, ref: t, style: { ...a, ...e.style } })
        );
      l.displayName = "VisuallyHidden";
      var u = l;
    },
    19526: (e, t, n) => {
      n.d(t, { Oh: () => i });
      var r = n(12115),
        o = 0;
      function i() {
        r.useEffect(() => {
          let e = document.querySelectorAll("[data-radix-focus-guard]");
          return (
            document.body.insertAdjacentElement("afterbegin", e[0] ?? a()),
            document.body.insertAdjacentElement("beforeend", e[1] ?? a()),
            o++,
            () => {
              (1 === o &&
                document.querySelectorAll("[data-radix-focus-guard]").forEach((e) => e.remove()),
                o--);
            }
          );
        }, []);
      }
      function a() {
        let e = document.createElement("span");
        return (
          e.setAttribute("data-radix-focus-guard", ""),
          (e.tabIndex = 0),
          (e.style.outline = "none"),
          (e.style.opacity = "0"),
          (e.style.position = "fixed"),
          (e.style.pointerEvents = "none"),
          e
        );
      }
    },
    40101: (e, t, n) => {
      n.d(t, { A: () => U });
      var r,
        o,
        i = function () {
          return (i =
            Object.assign ||
            function (e) {
              for (var t, n = 1, r = arguments.length; n < r; n++)
                for (var o in (t = arguments[n]))
                  Object.prototype.hasOwnProperty.call(t, o) && (e[o] = t[o]);
              return e;
            }).apply(this, arguments);
        };
      function a(e, t) {
        var n = {};
        for (var r in e)
          Object.prototype.hasOwnProperty.call(e, r) && 0 > t.indexOf(r) && (n[r] = e[r]);
        if (null != e && "function" == typeof Object.getOwnPropertySymbols)
          for (var o = 0, r = Object.getOwnPropertySymbols(e); o < r.length; o++)
            0 > t.indexOf(r[o]) &&
              Object.prototype.propertyIsEnumerable.call(e, r[o]) &&
              (n[r[o]] = e[r[o]]);
        return n;
      }
      Object.create;
      Object.create;
      var l = ("function" == typeof SuppressedError && SuppressedError, n(12115)),
        u = "right-scroll-bar-position",
        c = "width-before-scroll-bar";
      function s(e, t) {
        return ("function" == typeof e ? e(t) : e && (e.current = t), e);
      }
      var f = "undefined" != typeof window ? l.useLayoutEffect : l.useEffect,
        d = new WeakMap();
      function p(e) {
        return e;
      }
      var h = (function (e) {
          void 0 === e && (e = {});
          var t,
            n,
            r,
            o =
              (void 0 === t && (t = p),
              (n = []),
              (r = !1),
              {
                read: function () {
                  if (r)
                    throw Error(
                      "Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`."
                    );
                  return n.length ? n[n.length - 1] : null;
                },
                useMedium: function (e) {
                  var o = t(e, r);
                  return (
                    n.push(o),
                    function () {
                      n = n.filter(function (e) {
                        return e !== o;
                      });
                    }
                  );
                },
                assignSyncMedium: function (e) {
                  for (r = !0; n.length; ) {
                    var t = n;
                    ((n = []), t.forEach(e));
                  }
                  n = {
                    push: function (t) {
                      return e(t);
                    },
                    filter: function () {
                      return n;
                    },
                  };
                },
                assignMedium: function (e) {
                  r = !0;
                  var t = [];
                  if (n.length) {
                    var o = n;
                    ((n = []), o.forEach(e), (t = n));
                  }
                  var i = function () {
                      var n = t;
                      ((t = []), n.forEach(e));
                    },
                    a = function () {
                      return Promise.resolve().then(i);
                    };
                  (a(),
                    (n = {
                      push: function (e) {
                        (t.push(e), a());
                      },
                      filter: function (e) {
                        return ((t = t.filter(e)), n);
                      },
                    }));
                },
              });
          return ((o.options = i({ async: !0, ssr: !1 }, e)), o);
        })(),
        m = function () {},
        v = l.forwardRef(function (e, t) {
          var n,
            r,
            o,
            u,
            c = l.useRef(null),
            p = l.useState({ onScrollCapture: m, onWheelCapture: m, onTouchMoveCapture: m }),
            v = p[0],
            g = p[1],
            y = e.forwardProps,
            w = e.children,
            b = e.className,
            x = e.removeScrollBar,
            E = e.enabled,
            C = e.shards,
            R = e.sideCar,
            T = e.noRelative,
            L = e.noIsolation,
            A = e.inert,
            S = e.allowPinchZoom,
            P = e.as,
            k = e.gapMode,
            O = a(e, [
              "forwardProps",
              "children",
              "className",
              "removeScrollBar",
              "enabled",
              "shards",
              "sideCar",
              "noRelative",
              "noIsolation",
              "inert",
              "allowPinchZoom",
              "as",
              "gapMode",
            ]),
            N =
              ((n = [c, t]),
              (r = function (e) {
                return n.forEach(function (t) {
                  return s(t, e);
                });
              }),
              ((o = (0, l.useState)(function () {
                return {
                  value: null,
                  callback: r,
                  facade: {
                    get current() {
                      return o.value;
                    },
                    set current(value) {
                      var e = o.value;
                      e !== value && ((o.value = value), o.callback(value, e));
                    },
                  },
                };
              })[0]).callback = r),
              (u = o.facade),
              f(
                function () {
                  var e = d.get(u);
                  if (e) {
                    var t = new Set(e),
                      r = new Set(n),
                      o = u.current;
                    (t.forEach(function (e) {
                      r.has(e) || s(e, null);
                    }),
                      r.forEach(function (e) {
                        t.has(e) || s(e, o);
                      }));
                  }
                  d.set(u, n);
                },
                [n]
              ),
              u),
            D = i(i({}, O), v);
          return l.createElement(
            l.Fragment,
            null,
            E &&
              l.createElement(R, {
                sideCar: h,
                removeScrollBar: x,
                shards: C,
                noRelative: T,
                noIsolation: L,
                inert: A,
                setCallbacks: g,
                allowPinchZoom: !!S,
                lockRef: c,
                gapMode: k,
              }),
            y
              ? l.cloneElement(l.Children.only(w), i(i({}, D), { ref: N }))
              : l.createElement(void 0 === P ? "div" : P, i({}, D, { className: b, ref: N }), w)
          );
        });
      ((v.defaultProps = { enabled: !0, removeScrollBar: !0, inert: !1 }),
        (v.classNames = { fullWidth: c, zeroRight: u }));
      var g = function (e) {
        var t = e.sideCar,
          n = a(e, ["sideCar"]);
        if (!t) throw Error("Sidecar: please provide `sideCar` property to import the right car");
        var r = t.read();
        if (!r) throw Error("Sidecar medium not found");
        return l.createElement(r, i({}, n));
      };
      g.isSideCarExport = !0;
      var y = function () {
          var e = 0,
            t = null;
          return {
            add: function (r) {
              if (
                0 == e &&
                (t = (function () {
                  if (!document) return null;
                  var e = document.createElement("style");
                  e.type = "text/css";
                  var t = o || n.nc;
                  return (t && e.setAttribute("nonce", t), e);
                })())
              ) {
                var i, a;
                ((i = t).styleSheet
                  ? (i.styleSheet.cssText = r)
                  : i.appendChild(document.createTextNode(r)),
                  (a = t),
                  (document.head || document.getElementsByTagName("head")[0]).appendChild(a));
              }
              e++;
            },
            remove: function () {
              --e || !t || (t.parentNode && t.parentNode.removeChild(t), (t = null));
            },
          };
        },
        w = function () {
          var e = y();
          return function (t, n) {
            l.useEffect(
              function () {
                return (
                  e.add(t),
                  function () {
                    e.remove();
                  }
                );
              },
              [t && n]
            );
          };
        },
        b = function () {
          var e = w();
          return function (t) {
            return (e(t.styles, t.dynamic), null);
          };
        },
        x = { left: 0, top: 0, right: 0, gap: 0 },
        E = function (e) {
          return parseInt(e || "", 10) || 0;
        },
        C = function (e) {
          var t = window.getComputedStyle(document.body),
            n = t["padding" === e ? "paddingLeft" : "marginLeft"],
            r = t["padding" === e ? "paddingTop" : "marginTop"],
            o = t["padding" === e ? "paddingRight" : "marginRight"];
          return [E(n), E(r), E(o)];
        },
        R = function (e) {
          if ((void 0 === e && (e = "margin"), "undefined" == typeof window)) return x;
          var t = C(e),
            n = document.documentElement.clientWidth,
            r = window.innerWidth;
          return { left: t[0], top: t[1], right: t[2], gap: Math.max(0, r - n + t[2] - t[0]) };
        },
        T = b(),
        L = "data-scroll-locked",
        A = function (e, t, n, r) {
          var o = e.left,
            i = e.top,
            a = e.right,
            l = e.gap;
          return (
            void 0 === n && (n = "margin"),
            "\n  ."
              .concat("with-scroll-bars-hidden", " {\n   overflow: hidden ")
              .concat(r, ";\n   padding-right: ")
              .concat(l, "px ")
              .concat(r, ";\n  }\n  body[")
              .concat(L, "] {\n    overflow: hidden ")
              .concat(r, ";\n    overscroll-behavior: contain;\n    ")
              .concat(
                [
                  t && "position: relative ".concat(r, ";"),
                  "margin" === n &&
                    "\n    padding-left: "
                      .concat(o, "px;\n    padding-top: ")
                      .concat(i, "px;\n    padding-right: ")
                      .concat(a, "px;\n    margin-left:0;\n    margin-top:0;\n    margin-right: ")
                      .concat(l, "px ")
                      .concat(r, ";\n    "),
                  "padding" === n && "padding-right: ".concat(l, "px ").concat(r, ";"),
                ]
                  .filter(Boolean)
                  .join(""),
                "\n  }\n  \n  ."
              )
              .concat(u, " {\n    right: ")
              .concat(l, "px ")
              .concat(r, ";\n  }\n  \n  .")
              .concat(c, " {\n    margin-right: ")
              .concat(l, "px ")
              .concat(r, ";\n  }\n  \n  .")
              .concat(u, " .")
              .concat(u, " {\n    right: 0 ")
              .concat(r, ";\n  }\n  \n  .")
              .concat(c, " .")
              .concat(c, " {\n    margin-right: 0 ")
              .concat(r, ";\n  }\n  \n  body[")
              .concat(L, "] {\n    ")
              .concat("--removed-body-scroll-bar-size", ": ")
              .concat(l, "px;\n  }\n")
          );
        },
        S = function () {
          var e = parseInt(document.body.getAttribute(L) || "0", 10);
          return isFinite(e) ? e : 0;
        },
        P = function () {
          l.useEffect(function () {
            return (
              document.body.setAttribute(L, (S() + 1).toString()),
              function () {
                var e = S() - 1;
                e <= 0
                  ? document.body.removeAttribute(L)
                  : document.body.setAttribute(L, e.toString());
              }
            );
          }, []);
        },
        k = function (e) {
          var t = e.noRelative,
            n = e.noImportant,
            r = e.gapMode,
            o = void 0 === r ? "margin" : r;
          P();
          var i = l.useMemo(
            function () {
              return R(o);
            },
            [o]
          );
          return l.createElement(T, { styles: A(i, !t, o, n ? "" : "!important") });
        },
        O = !1;
      if ("undefined" != typeof window)
        try {
          var N = Object.defineProperty({}, "passive", {
            get: function () {
              return ((O = !0), !0);
            },
          });
          (window.addEventListener("test", N, N), window.removeEventListener("test", N, N));
        } catch (e) {
          O = !1;
        }
      var D = !!O && { passive: !1 },
        M = function (e, t) {
          if (!(e instanceof Element)) return !1;
          var n = window.getComputedStyle(e);
          return (
            "hidden" !== n[t] &&
            (n.overflowY !== n.overflowX || "TEXTAREA" === e.tagName || "visible" !== n[t])
          );
        },
        j = function (e, t) {
          var n = t.ownerDocument,
            r = t;
          do {
            if (
              ("undefined" != typeof ShadowRoot && r instanceof ShadowRoot && (r = r.host), W(e, r))
            ) {
              var o = F(e, r);
              if (o[1] > o[2]) return !0;
            }
            r = r.parentNode;
          } while (r && r !== n.body);
          return !1;
        },
        W = function (e, t) {
          return "v" === e ? M(t, "overflowY") : M(t, "overflowX");
        },
        F = function (e, t) {
          return "v" === e
            ? [t.scrollTop, t.scrollHeight, t.clientHeight]
            : [t.scrollLeft, t.scrollWidth, t.clientWidth];
        },
        B = function (e, t, n, r, o) {
          var i,
            a = ((i = window.getComputedStyle(t).direction), "h" === e && "rtl" === i ? -1 : 1),
            l = a * r,
            u = n.target,
            c = t.contains(u),
            s = !1,
            f = l > 0,
            d = 0,
            p = 0;
          do {
            if (!u) break;
            var h = F(e, u),
              m = h[0],
              v = h[1] - h[2] - a * m;
            (m || v) && W(e, u) && ((d += v), (p += m));
            var g = u.parentNode;
            u = g && g.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? g.host : g;
          } while ((!c && u !== document.body) || (c && (t.contains(u) || t === u)));
          return (
            f && ((o && 1 > Math.abs(d)) || (!o && l > d))
              ? (s = !0)
              : !f && ((o && 1 > Math.abs(p)) || (!o && -l > p)) && (s = !0),
            s
          );
        },
        H = function (e) {
          return "changedTouches" in e
            ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY]
            : [0, 0];
        },
        I = function (e) {
          return [e.deltaX, e.deltaY];
        },
        _ = function (e) {
          return e && "current" in e ? e.current : e;
        },
        z = 0,
        Y = [];
      let X =
        ((r = function (e) {
          var t = l.useRef([]),
            n = l.useRef([0, 0]),
            r = l.useRef(),
            o = l.useState(z++)[0],
            i = l.useState(b)[0],
            a = l.useRef(e);
          (l.useEffect(
            function () {
              a.current = e;
            },
            [e]
          ),
            l.useEffect(
              function () {
                if (e.inert) {
                  document.body.classList.add("block-interactivity-".concat(o));
                  var t = (function (e, t, n) {
                    if (n || 2 == arguments.length)
                      for (var r, o = 0, i = t.length; o < i; o++)
                        (!r && o in t) ||
                          (r || (r = Array.prototype.slice.call(t, 0, o)), (r[o] = t[o]));
                    return e.concat(r || Array.prototype.slice.call(t));
                  })([e.lockRef.current], (e.shards || []).map(_), !0).filter(Boolean);
                  return (
                    t.forEach(function (e) {
                      return e.classList.add("allow-interactivity-".concat(o));
                    }),
                    function () {
                      (document.body.classList.remove("block-interactivity-".concat(o)),
                        t.forEach(function (e) {
                          return e.classList.remove("allow-interactivity-".concat(o));
                        }));
                    }
                  );
                }
              },
              [e.inert, e.lockRef.current, e.shards]
            ));
          var u = l.useCallback(function (e, t) {
              if (("touches" in e && 2 === e.touches.length) || ("wheel" === e.type && e.ctrlKey))
                return !a.current.allowPinchZoom;
              var o,
                i = H(e),
                l = n.current,
                u = "deltaX" in e ? e.deltaX : l[0] - i[0],
                c = "deltaY" in e ? e.deltaY : l[1] - i[1],
                s = e.target,
                f = Math.abs(u) > Math.abs(c) ? "h" : "v";
              if ("touches" in e && "h" === f && "range" === s.type) return !1;
              var d = j(f, s);
              if (!d) return !0;
              if ((d ? (o = f) : ((o = "v" === f ? "h" : "v"), (d = j(f, s))), !d)) return !1;
              if ((!r.current && "changedTouches" in e && (u || c) && (r.current = o), !o))
                return !0;
              var p = r.current || o;
              return B(p, t, e, "h" === p ? u : c, !0);
            }, []),
            c = l.useCallback(function (e) {
              if (Y.length && Y[Y.length - 1] === i) {
                var n = "deltaY" in e ? I(e) : H(e),
                  r = t.current.filter(function (t) {
                    var r;
                    return (
                      t.name === e.type &&
                      (t.target === e.target || e.target === t.shadowParent) &&
                      ((r = t.delta), r[0] === n[0] && r[1] === n[1])
                    );
                  })[0];
                if (r && r.should) {
                  e.cancelable && e.preventDefault();
                  return;
                }
                if (!r) {
                  var o = (a.current.shards || [])
                    .map(_)
                    .filter(Boolean)
                    .filter(function (t) {
                      return t.contains(e.target);
                    });
                  (o.length > 0 ? u(e, o[0]) : !a.current.noIsolation) &&
                    e.cancelable &&
                    e.preventDefault();
                }
              }
            }, []),
            s = l.useCallback(function (e, n, r, o) {
              var i = {
                name: e,
                delta: n,
                target: r,
                should: o,
                shadowParent: (function (e) {
                  for (var t = null; null !== e; )
                    (e instanceof ShadowRoot && ((t = e.host), (e = e.host)), (e = e.parentNode));
                  return t;
                })(r),
              };
              (t.current.push(i),
                setTimeout(function () {
                  t.current = t.current.filter(function (e) {
                    return e !== i;
                  });
                }, 1));
            }, []),
            f = l.useCallback(function (e) {
              ((n.current = H(e)), (r.current = void 0));
            }, []),
            d = l.useCallback(function (t) {
              s(t.type, I(t), t.target, u(t, e.lockRef.current));
            }, []),
            p = l.useCallback(function (t) {
              s(t.type, H(t), t.target, u(t, e.lockRef.current));
            }, []);
          l.useEffect(function () {
            return (
              Y.push(i),
              e.setCallbacks({ onScrollCapture: d, onWheelCapture: d, onTouchMoveCapture: p }),
              document.addEventListener("wheel", c, D),
              document.addEventListener("touchmove", c, D),
              document.addEventListener("touchstart", f, D),
              function () {
                ((Y = Y.filter(function (e) {
                  return e !== i;
                })),
                  document.removeEventListener("wheel", c, D),
                  document.removeEventListener("touchmove", c, D),
                  document.removeEventListener("touchstart", f, D));
              }
            );
          }, []);
          var h = e.removeScrollBar,
            m = e.inert;
          return l.createElement(
            l.Fragment,
            null,
            m
              ? l.createElement(i, {
                  styles: "\n  .block-interactivity-"
                    .concat(o, " {pointer-events: none;}\n  .allow-interactivity-")
                    .concat(o, " {pointer-events: all;}\n"),
                })
              : null,
            h ? l.createElement(k, { noRelative: e.noRelative, gapMode: e.gapMode }) : null
          );
        }),
        h.useMedium(r),
        g);
      var $ = l.forwardRef(function (e, t) {
        return l.createElement(v, i({}, e, { ref: t, sideCar: X }));
      });
      $.classNames = v.classNames;
      let U = $;
    },
    44831: (e, t, n) => {
      n.d(t, { lg: () => g, qW: () => d, bL: () => v });
      var r,
        o = n(12115),
        i = n(92556),
        a = n(97602),
        l = n(94446),
        u = n(70222),
        c = n(95155),
        s = "dismissableLayer.update",
        f = o.createContext({
          layers: new Set(),
          layersWithOutsidePointerEventsDisabled: new Set(),
          branches: new Set(),
        }),
        d = o.forwardRef((e, t) => {
          let {
              disableOutsidePointerEvents: n = !1,
              onEscapeKeyDown: d,
              onPointerDownOutside: p,
              onFocusOutside: v,
              onInteractOutside: g,
              onDismiss: y,
              ...w
            } = e,
            b = o.useContext(f),
            [x, E] = o.useState(null),
            C = x?.ownerDocument ?? globalThis?.document,
            [, R] = o.useState({}),
            T = (0, l.s)(t, (e) => E(e)),
            L = Array.from(b.layers),
            [A] = [...b.layersWithOutsidePointerEventsDisabled].slice(-1),
            S = L.indexOf(A),
            P = x ? L.indexOf(x) : -1,
            k = b.layersWithOutsidePointerEventsDisabled.size > 0,
            O = P >= S,
            N = (function (e) {
              let t =
                  arguments.length > 1 && void 0 !== arguments[1]
                    ? arguments[1]
                    : globalThis?.document,
                n = (0, u.c)(e),
                r = o.useRef(!1),
                i = o.useRef(() => {});
              return (
                o.useEffect(() => {
                  let e = (e) => {
                      if (e.target && !r.current) {
                        let r = function () {
                            m("dismissableLayer.pointerDownOutside", n, o, { discrete: !0 });
                          },
                          o = { originalEvent: e };
                        "touch" === e.pointerType
                          ? (t.removeEventListener("click", i.current),
                            (i.current = r),
                            t.addEventListener("click", i.current, { once: !0 }))
                          : r();
                      } else t.removeEventListener("click", i.current);
                      r.current = !1;
                    },
                    o = window.setTimeout(() => {
                      t.addEventListener("pointerdown", e);
                    }, 0);
                  return () => {
                    (window.clearTimeout(o),
                      t.removeEventListener("pointerdown", e),
                      t.removeEventListener("click", i.current));
                  };
                }, [t, n]),
                { onPointerDownCapture: () => (r.current = !0) }
              );
            })((e) => {
              let t = e.target,
                n = [...b.branches].some((e) => e.contains(t));
              O && !n && (p?.(e), g?.(e), e.defaultPrevented || y?.());
            }, C),
            D = (function (e) {
              let t =
                  arguments.length > 1 && void 0 !== arguments[1]
                    ? arguments[1]
                    : globalThis?.document,
                n = (0, u.c)(e),
                r = o.useRef(!1);
              return (
                o.useEffect(() => {
                  let e = (e) => {
                    e.target &&
                      !r.current &&
                      m("dismissableLayer.focusOutside", n, { originalEvent: e }, { discrete: !1 });
                  };
                  return (
                    t.addEventListener("focusin", e),
                    () => t.removeEventListener("focusin", e)
                  );
                }, [t, n]),
                { onFocusCapture: () => (r.current = !0), onBlurCapture: () => (r.current = !1) }
              );
            })((e) => {
              let t = e.target;
              ![...b.branches].some((e) => e.contains(t)) &&
                (v?.(e), g?.(e), e.defaultPrevented || y?.());
            }, C);
          return (
            !(function (e, t = globalThis?.document) {
              let n = (0, u.c)(e);
              o.useEffect(() => {
                let e = (e) => {
                  "Escape" === e.key && n(e);
                };
                return (
                  t.addEventListener("keydown", e, { capture: !0 }),
                  () => t.removeEventListener("keydown", e, { capture: !0 })
                );
              }, [n, t]);
            })((e) => {
              P === b.layers.size - 1 &&
                (d?.(e), !e.defaultPrevented && y && (e.preventDefault(), y()));
            }, C),
            o.useEffect(() => {
              if (x)
                return (
                  n &&
                    (0 === b.layersWithOutsidePointerEventsDisabled.size &&
                      ((r = C.body.style.pointerEvents), (C.body.style.pointerEvents = "none")),
                    b.layersWithOutsidePointerEventsDisabled.add(x)),
                  b.layers.add(x),
                  h(),
                  () => {
                    n &&
                      1 === b.layersWithOutsidePointerEventsDisabled.size &&
                      (C.body.style.pointerEvents = r);
                  }
                );
            }, [x, C, n, b]),
            o.useEffect(
              () => () => {
                x && (b.layers.delete(x), b.layersWithOutsidePointerEventsDisabled.delete(x), h());
              },
              [x, b]
            ),
            o.useEffect(() => {
              let e = () => R({});
              return (document.addEventListener(s, e), () => document.removeEventListener(s, e));
            }, []),
            (0, c.jsx)(a.sG.div, {
              ...w,
              ref: T,
              style: { pointerEvents: k ? (O ? "auto" : "none") : void 0, ...e.style },
              onFocusCapture: (0, i.m)(e.onFocusCapture, D.onFocusCapture),
              onBlurCapture: (0, i.m)(e.onBlurCapture, D.onBlurCapture),
              onPointerDownCapture: (0, i.m)(e.onPointerDownCapture, N.onPointerDownCapture),
            })
          );
        });
      d.displayName = "DismissableLayer";
      var p = o.forwardRef((e, t) => {
        let n = o.useContext(f),
          r = o.useRef(null),
          i = (0, l.s)(t, r);
        return (
          o.useEffect(() => {
            let e = r.current;
            if (e)
              return (
                n.branches.add(e),
                () => {
                  n.branches.delete(e);
                }
              );
          }, [n.branches]),
          (0, c.jsx)(a.sG.div, { ...e, ref: i })
        );
      });
      function h() {
        let e = new CustomEvent(s);
        document.dispatchEvent(e);
      }
      function m(e, t, n, r) {
        let { discrete: o } = r,
          i = n.originalEvent.target,
          l = new CustomEvent(e, { bubbles: !1, cancelable: !0, detail: n });
        (t && i.addEventListener(e, t, { once: !0 }), o ? (0, a.hO)(i, l) : i.dispatchEvent(l));
      }
      p.displayName = "DismissableLayerBranch";
      var v = d,
        g = p;
    },
    47520: (e, t, n) => {
      (n.r(t),
        n.d(t, {
          Arrow: () => K,
          Content: () => G,
          Portal: () => V,
          Provider: () => X,
          Root: () => $,
          Tooltip: () => S,
          TooltipArrow: () => Y,
          TooltipContent: () => W,
          TooltipPortal: () => M,
          TooltipProvider: () => R,
          TooltipTrigger: () => k,
          Trigger: () => U,
          createTooltipScope: () => y,
        }));
      var r = n(12115),
        o = n(92556),
        i = n(94446),
        a = n(3468),
        l = n(44831),
        u = n(68946),
        c = n(73867),
        s = n(75433),
        f = n(76842),
        d = n(97602),
        p = n(32467),
        h = n(23558),
        m = n(861),
        v = n(95155),
        [g, y] = (0, a.A)("Tooltip", [c.Bk]),
        w = (0, c.Bk)(),
        b = "TooltipProvider",
        x = "tooltip.open",
        [E, C] = g(b),
        R = (e) => {
          let {
              __scopeTooltip: t,
              delayDuration: n = 700,
              skipDelayDuration: o = 300,
              disableHoverableContent: i = !1,
              children: a,
            } = e,
            l = r.useRef(!0),
            u = r.useRef(!1),
            c = r.useRef(0);
          return (
            r.useEffect(() => {
              let e = c.current;
              return () => window.clearTimeout(e);
            }, []),
            (0, v.jsx)(E, {
              scope: t,
              isOpenDelayedRef: l,
              delayDuration: n,
              onOpen: r.useCallback(() => {
                (window.clearTimeout(c.current), (l.current = !1));
              }, []),
              onClose: r.useCallback(() => {
                (window.clearTimeout(c.current),
                  (c.current = window.setTimeout(() => (l.current = !0), o)));
              }, [o]),
              isPointerInTransitRef: u,
              onPointerInTransitChange: r.useCallback((e) => {
                u.current = e;
              }, []),
              disableHoverableContent: i,
              children: a,
            })
          );
        };
      R.displayName = b;
      var T = "Tooltip",
        [L, A] = g(T),
        S = (e) => {
          let {
              __scopeTooltip: t,
              children: n,
              open: o,
              defaultOpen: i,
              onOpenChange: a,
              disableHoverableContent: l,
              delayDuration: s,
            } = e,
            f = C(T, e.__scopeTooltip),
            d = w(t),
            [p, m] = r.useState(null),
            g = (0, u.B)(),
            y = r.useRef(0),
            b = l ?? f.disableHoverableContent,
            E = s ?? f.delayDuration,
            R = r.useRef(!1),
            [A, S] = (0, h.i)({
              prop: o,
              defaultProp: i ?? !1,
              onChange: (e) => {
                (e ? (f.onOpen(), document.dispatchEvent(new CustomEvent(x))) : f.onClose(),
                  a?.(e));
              },
              caller: T,
            }),
            P = r.useMemo(
              () => (A ? (R.current ? "delayed-open" : "instant-open") : "closed"),
              [A]
            ),
            k = r.useCallback(() => {
              (window.clearTimeout(y.current), (y.current = 0), (R.current = !1), S(!0));
            }, [S]),
            O = r.useCallback(() => {
              (window.clearTimeout(y.current), (y.current = 0), S(!1));
            }, [S]),
            N = r.useCallback(() => {
              (window.clearTimeout(y.current),
                (y.current = window.setTimeout(() => {
                  ((R.current = !0), S(!0), (y.current = 0));
                }, E)));
            }, [E, S]);
          return (
            r.useEffect(
              () => () => {
                y.current && (window.clearTimeout(y.current), (y.current = 0));
              },
              []
            ),
            (0, v.jsx)(c.bL, {
              ...d,
              children: (0, v.jsx)(L, {
                scope: t,
                contentId: g,
                open: A,
                stateAttribute: P,
                trigger: p,
                onTriggerChange: m,
                onTriggerEnter: r.useCallback(() => {
                  f.isOpenDelayedRef.current ? N() : k();
                }, [f.isOpenDelayedRef, N, k]),
                onTriggerLeave: r.useCallback(() => {
                  b ? O() : (window.clearTimeout(y.current), (y.current = 0));
                }, [O, b]),
                onOpen: k,
                onClose: O,
                disableHoverableContent: b,
                children: n,
              }),
            })
          );
        };
      S.displayName = T;
      var P = "TooltipTrigger",
        k = r.forwardRef((e, t) => {
          let { __scopeTooltip: n, ...a } = e,
            l = A(P, n),
            u = C(P, n),
            s = w(n),
            f = r.useRef(null),
            p = (0, i.s)(t, f, l.onTriggerChange),
            h = r.useRef(!1),
            m = r.useRef(!1),
            g = r.useCallback(() => (h.current = !1), []);
          return (
            r.useEffect(() => () => document.removeEventListener("pointerup", g), [g]),
            (0, v.jsx)(c.Mz, {
              asChild: !0,
              ...s,
              children: (0, v.jsx)(d.sG.button, {
                "aria-describedby": l.open ? l.contentId : void 0,
                "data-state": l.stateAttribute,
                ...a,
                ref: p,
                onPointerMove: (0, o.m)(e.onPointerMove, (e) => {
                  "touch" !== e.pointerType &&
                    (m.current ||
                      u.isPointerInTransitRef.current ||
                      (l.onTriggerEnter(), (m.current = !0)));
                }),
                onPointerLeave: (0, o.m)(e.onPointerLeave, () => {
                  (l.onTriggerLeave(), (m.current = !1));
                }),
                onPointerDown: (0, o.m)(e.onPointerDown, () => {
                  (l.open && l.onClose(),
                    (h.current = !0),
                    document.addEventListener("pointerup", g, { once: !0 }));
                }),
                onFocus: (0, o.m)(e.onFocus, () => {
                  h.current || l.onOpen();
                }),
                onBlur: (0, o.m)(e.onBlur, l.onClose),
                onClick: (0, o.m)(e.onClick, l.onClose),
              }),
            })
          );
        });
      k.displayName = P;
      var O = "TooltipPortal",
        [N, D] = g(O, { forceMount: void 0 }),
        M = (e) => {
          let { __scopeTooltip: t, forceMount: n, children: r, container: o } = e,
            i = A(O, t);
          return (0, v.jsx)(N, {
            scope: t,
            forceMount: n,
            children: (0, v.jsx)(f.C, {
              present: n || i.open,
              children: (0, v.jsx)(s.Portal, { asChild: !0, container: o, children: r }),
            }),
          });
        };
      M.displayName = O;
      var j = "TooltipContent",
        W = r.forwardRef((e, t) => {
          let n = D(j, e.__scopeTooltip),
            { forceMount: r = n.forceMount, side: o = "top", ...i } = e,
            a = A(j, e.__scopeTooltip);
          return (0, v.jsx)(f.C, {
            present: r || a.open,
            children: a.disableHoverableContent
              ? (0, v.jsx)(_, { side: o, ...i, ref: t })
              : (0, v.jsx)(F, { side: o, ...i, ref: t }),
          });
        }),
        F = r.forwardRef((e, t) => {
          let n = A(j, e.__scopeTooltip),
            o = C(j, e.__scopeTooltip),
            a = r.useRef(null),
            l = (0, i.s)(t, a),
            [u, c] = r.useState(null),
            { trigger: s, onClose: f } = n,
            d = a.current,
            { onPointerInTransitChange: p } = o,
            h = r.useCallback(() => {
              (c(null), p(!1));
            }, [p]),
            m = r.useCallback(
              (e, t) => {
                let n = e.currentTarget,
                  r = { x: e.clientX, y: e.clientY },
                  o = (function (e, t) {
                    let n = Math.abs(t.top - e.y),
                      r = Math.abs(t.bottom - e.y),
                      o = Math.abs(t.right - e.x),
                      i = Math.abs(t.left - e.x);
                    switch (Math.min(n, r, o, i)) {
                      case i:
                        return "left";
                      case o:
                        return "right";
                      case n:
                        return "top";
                      case r:
                        return "bottom";
                      default:
                        throw Error("unreachable");
                    }
                  })(r, n.getBoundingClientRect());
                (c(
                  (function (e) {
                    let t = e.slice();
                    return (
                      t.sort((e, t) =>
                        e.x < t.x ? -1 : e.x > t.x ? 1 : e.y < t.y ? -1 : 1 * !!(e.y > t.y)
                      ),
                      (function (e) {
                        if (e.length <= 1) return e.slice();
                        let t = [];
                        for (let n = 0; n < e.length; n++) {
                          let r = e[n];
                          for (; t.length >= 2; ) {
                            let e = t[t.length - 1],
                              n = t[t.length - 2];
                            if ((e.x - n.x) * (r.y - n.y) >= (e.y - n.y) * (r.x - n.x)) t.pop();
                            else break;
                          }
                          t.push(r);
                        }
                        t.pop();
                        let n = [];
                        for (let t = e.length - 1; t >= 0; t--) {
                          let r = e[t];
                          for (; n.length >= 2; ) {
                            let e = n[n.length - 1],
                              t = n[n.length - 2];
                            if ((e.x - t.x) * (r.y - t.y) >= (e.y - t.y) * (r.x - t.x)) n.pop();
                            else break;
                          }
                          n.push(r);
                        }
                        return (n.pop(),
                        1 === t.length && 1 === n.length && t[0].x === n[0].x && t[0].y === n[0].y)
                          ? t
                          : t.concat(n);
                      })(t)
                    );
                  })([
                    ...(function (e, t) {
                      let n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : 5,
                        r = [];
                      switch (t) {
                        case "top":
                          r.push({ x: e.x - n, y: e.y + n }, { x: e.x + n, y: e.y + n });
                          break;
                        case "bottom":
                          r.push({ x: e.x - n, y: e.y - n }, { x: e.x + n, y: e.y - n });
                          break;
                        case "left":
                          r.push({ x: e.x + n, y: e.y - n }, { x: e.x + n, y: e.y + n });
                          break;
                        case "right":
                          r.push({ x: e.x - n, y: e.y - n }, { x: e.x - n, y: e.y + n });
                      }
                      return r;
                    })(r, o),
                    ...(function (e) {
                      let { top: t, right: n, bottom: r, left: o } = e;
                      return [
                        { x: o, y: t },
                        { x: n, y: t },
                        { x: n, y: r },
                        { x: o, y: r },
                      ];
                    })(t.getBoundingClientRect()),
                  ])
                ),
                  p(!0));
              },
              [p]
            );
          return (
            r.useEffect(() => () => h(), [h]),
            r.useEffect(() => {
              if (s && d) {
                let e = (e) => m(e, d),
                  t = (e) => m(e, s);
                return (
                  s.addEventListener("pointerleave", e),
                  d.addEventListener("pointerleave", t),
                  () => {
                    (s.removeEventListener("pointerleave", e),
                      d.removeEventListener("pointerleave", t));
                  }
                );
              }
            }, [s, d, m, h]),
            r.useEffect(() => {
              if (u) {
                let e = (e) => {
                  let t = e.target,
                    n = { x: e.clientX, y: e.clientY },
                    r = s?.contains(t) || d?.contains(t),
                    o = !(function (e, t) {
                      let { x: n, y: r } = e,
                        o = !1;
                      for (let e = 0, i = t.length - 1; e < t.length; i = e++) {
                        let a = t[e],
                          l = t[i],
                          u = a.x,
                          c = a.y,
                          s = l.x,
                          f = l.y;
                        c > r != f > r && n < ((s - u) * (r - c)) / (f - c) + u && (o = !o);
                      }
                      return o;
                    })(n, u);
                  r ? h() : o && (h(), f());
                };
                return (
                  document.addEventListener("pointermove", e),
                  () => document.removeEventListener("pointermove", e)
                );
              }
            }, [s, d, u, f, h]),
            (0, v.jsx)(_, { ...e, ref: l })
          );
        }),
        [B, H] = g(T, { isInside: !1 }),
        I = (0, p.Dc)("TooltipContent"),
        _ = r.forwardRef((e, t) => {
          let {
              __scopeTooltip: n,
              children: o,
              "aria-label": i,
              onEscapeKeyDown: a,
              onPointerDownOutside: u,
              ...s
            } = e,
            f = A(j, n),
            d = w(n),
            { onClose: p } = f;
          return (
            r.useEffect(
              () => (document.addEventListener(x, p), () => document.removeEventListener(x, p)),
              [p]
            ),
            r.useEffect(() => {
              if (f.trigger) {
                let e = (e) => {
                  let t = e.target;
                  t?.contains(f.trigger) && p();
                };
                return (
                  window.addEventListener("scroll", e, { capture: !0 }),
                  () => window.removeEventListener("scroll", e, { capture: !0 })
                );
              }
            }, [f.trigger, p]),
            (0, v.jsx)(l.qW, {
              asChild: !0,
              disableOutsidePointerEvents: !1,
              onEscapeKeyDown: a,
              onPointerDownOutside: u,
              onFocusOutside: (e) => e.preventDefault(),
              onDismiss: p,
              children: (0, v.jsxs)(c.UC, {
                "data-state": f.stateAttribute,
                ...d,
                ...s,
                ref: t,
                style: {
                  ...s.style,
                  "--radix-tooltip-content-transform-origin":
                    "var(--radix-popper-transform-origin)",
                  "--radix-tooltip-content-available-width": "var(--radix-popper-available-width)",
                  "--radix-tooltip-content-available-height":
                    "var(--radix-popper-available-height)",
                  "--radix-tooltip-trigger-width": "var(--radix-popper-anchor-width)",
                  "--radix-tooltip-trigger-height": "var(--radix-popper-anchor-height)",
                },
                children: [
                  (0, v.jsx)(I, { children: o }),
                  (0, v.jsx)(B, {
                    scope: n,
                    isInside: !0,
                    children: (0, v.jsx)(m.bL, {
                      id: f.contentId,
                      role: "tooltip",
                      children: i || o,
                    }),
                  }),
                ],
              }),
            })
          );
        });
      W.displayName = j;
      var z = "TooltipArrow",
        Y = r.forwardRef((e, t) => {
          let { __scopeTooltip: n, ...r } = e,
            o = w(n);
          return H(z, n).isInside ? null : (0, v.jsx)(c.i3, { ...o, ...r, ref: t });
        });
      Y.displayName = z;
      var X = R,
        $ = S,
        U = k,
        V = M,
        G = W,
        K = Y;
    },
    58146: (e, t, n) => {
      n.d(t, {
        UE: () => ed,
        ll: () => ea,
        rD: () => eh,
        UU: () => ec,
        jD: () => ef,
        ER: () => ep,
        cY: () => el,
        BN: () => eu,
        Ej: () => es,
      });
      let r = ["top", "right", "bottom", "left"],
        o = Math.min,
        i = Math.max,
        a = Math.round,
        l = Math.floor,
        u = (e) => ({ x: e, y: e }),
        c = { left: "right", right: "left", bottom: "top", top: "bottom" },
        s = { start: "end", end: "start" };
      function f(e, t) {
        return "function" == typeof e ? e(t) : e;
      }
      function d(e) {
        return e.split("-")[0];
      }
      function p(e) {
        return e.split("-")[1];
      }
      function h(e) {
        return "x" === e ? "y" : "x";
      }
      function m(e) {
        return "y" === e ? "height" : "width";
      }
      function v(e) {
        return ["top", "bottom"].includes(d(e)) ? "y" : "x";
      }
      function g(e) {
        return e.replace(/start|end/g, (e) => s[e]);
      }
      function y(e) {
        return e.replace(/left|right|bottom|top/g, (e) => c[e]);
      }
      function w(e) {
        return "number" != typeof e
          ? { top: 0, right: 0, bottom: 0, left: 0, ...e }
          : { top: e, right: e, bottom: e, left: e };
      }
      function b(e) {
        let { x: t, y: n, width: r, height: o } = e;
        return { width: r, height: o, top: n, left: t, right: t + r, bottom: n + o, x: t, y: n };
      }
      function x(e, t, n) {
        let r,
          { reference: o, floating: i } = e,
          a = v(t),
          l = h(v(t)),
          u = m(l),
          c = d(t),
          s = "y" === a,
          f = o.x + o.width / 2 - i.width / 2,
          g = o.y + o.height / 2 - i.height / 2,
          y = o[u] / 2 - i[u] / 2;
        switch (c) {
          case "top":
            r = { x: f, y: o.y - i.height };
            break;
          case "bottom":
            r = { x: f, y: o.y + o.height };
            break;
          case "right":
            r = { x: o.x + o.width, y: g };
            break;
          case "left":
            r = { x: o.x - i.width, y: g };
            break;
          default:
            r = { x: o.x, y: o.y };
        }
        switch (p(t)) {
          case "start":
            r[l] -= y * (n && s ? -1 : 1);
            break;
          case "end":
            r[l] += y * (n && s ? -1 : 1);
        }
        return r;
      }
      let E = async (e, t, n) => {
        let {
            placement: r = "bottom",
            strategy: o = "absolute",
            middleware: i = [],
            platform: a,
          } = n,
          l = i.filter(Boolean),
          u = await (null == a.isRTL ? void 0 : a.isRTL(t)),
          c = await a.getElementRects({ reference: e, floating: t, strategy: o }),
          { x: s, y: f } = x(c, r, u),
          d = r,
          p = {},
          h = 0;
        for (let n = 0; n < l.length; n++) {
          let { name: i, fn: m } = l[n],
            {
              x: v,
              y: g,
              data: y,
              reset: w,
            } = await m({
              x: s,
              y: f,
              initialPlacement: r,
              placement: d,
              strategy: o,
              middlewareData: p,
              rects: c,
              platform: a,
              elements: { reference: e, floating: t },
            });
          ((s = null != v ? v : s),
            (f = null != g ? g : f),
            (p = { ...p, [i]: { ...p[i], ...y } }),
            w &&
              h <= 50 &&
              (h++,
              "object" == typeof w &&
                (w.placement && (d = w.placement),
                w.rects &&
                  (c =
                    !0 === w.rects
                      ? await a.getElementRects({ reference: e, floating: t, strategy: o })
                      : w.rects),
                ({ x: s, y: f } = x(c, d, u))),
              (n = -1)));
        }
        return { x: s, y: f, placement: d, strategy: o, middlewareData: p };
      };
      async function C(e, t) {
        var n;
        void 0 === t && (t = {});
        let { x: r, y: o, platform: i, rects: a, elements: l, strategy: u } = e,
          {
            boundary: c = "clippingAncestors",
            rootBoundary: s = "viewport",
            elementContext: d = "floating",
            altBoundary: p = !1,
            padding: h = 0,
          } = f(t, e),
          m = w(h),
          v = l[p ? ("floating" === d ? "reference" : "floating") : d],
          g = b(
            await i.getClippingRect({
              element:
                null == (n = await (null == i.isElement ? void 0 : i.isElement(v))) || n
                  ? v
                  : v.contextElement ||
                    (await (null == i.getDocumentElement
                      ? void 0
                      : i.getDocumentElement(l.floating))),
              boundary: c,
              rootBoundary: s,
              strategy: u,
            })
          ),
          y =
            "floating" === d
              ? { x: r, y: o, width: a.floating.width, height: a.floating.height }
              : a.reference,
          x = await (null == i.getOffsetParent ? void 0 : i.getOffsetParent(l.floating)),
          E = ((await (null == i.isElement ? void 0 : i.isElement(x))) &&
            (await (null == i.getScale ? void 0 : i.getScale(x)))) || { x: 1, y: 1 },
          C = b(
            i.convertOffsetParentRelativeRectToViewportRelativeRect
              ? await i.convertOffsetParentRelativeRectToViewportRelativeRect({
                  elements: l,
                  rect: y,
                  offsetParent: x,
                  strategy: u,
                })
              : y
          );
        return {
          top: (g.top - C.top + m.top) / E.y,
          bottom: (C.bottom - g.bottom + m.bottom) / E.y,
          left: (g.left - C.left + m.left) / E.x,
          right: (C.right - g.right + m.right) / E.x,
        };
      }
      function R(e, t) {
        return {
          top: e.top - t.height,
          right: e.right - t.width,
          bottom: e.bottom - t.height,
          left: e.left - t.width,
        };
      }
      function T(e) {
        return r.some((t) => e[t] >= 0);
      }
      async function L(e, t) {
        let { placement: n, platform: r, elements: o } = e,
          i = await (null == r.isRTL ? void 0 : r.isRTL(o.floating)),
          a = d(n),
          l = p(n),
          u = "y" === v(n),
          c = ["left", "top"].includes(a) ? -1 : 1,
          s = i && u ? -1 : 1,
          h = f(t, e),
          {
            mainAxis: m,
            crossAxis: g,
            alignmentAxis: y,
          } = "number" == typeof h
            ? { mainAxis: h, crossAxis: 0, alignmentAxis: null }
            : {
                mainAxis: h.mainAxis || 0,
                crossAxis: h.crossAxis || 0,
                alignmentAxis: h.alignmentAxis,
              };
        return (
          l && "number" == typeof y && (g = "end" === l ? -1 * y : y),
          u ? { x: g * s, y: m * c } : { x: m * c, y: g * s }
        );
      }
      function A() {
        return "undefined" != typeof window;
      }
      function S(e) {
        return O(e) ? (e.nodeName || "").toLowerCase() : "#document";
      }
      function P(e) {
        var t;
        return (null == e || null == (t = e.ownerDocument) ? void 0 : t.defaultView) || window;
      }
      function k(e) {
        var t;
        return null == (t = (O(e) ? e.ownerDocument : e.document) || window.document)
          ? void 0
          : t.documentElement;
      }
      function O(e) {
        return !!A() && (e instanceof Node || e instanceof P(e).Node);
      }
      function N(e) {
        return !!A() && (e instanceof Element || e instanceof P(e).Element);
      }
      function D(e) {
        return !!A() && (e instanceof HTMLElement || e instanceof P(e).HTMLElement);
      }
      function M(e) {
        return (
          !!A() &&
          "undefined" != typeof ShadowRoot &&
          (e instanceof ShadowRoot || e instanceof P(e).ShadowRoot)
        );
      }
      function j(e) {
        let { overflow: t, overflowX: n, overflowY: r, display: o } = I(e);
        return (
          /auto|scroll|overlay|hidden|clip/.test(t + r + n) && !["inline", "contents"].includes(o)
        );
      }
      function W(e) {
        return [":popover-open", ":modal"].some((t) => {
          try {
            return e.matches(t);
          } catch (e) {
            return !1;
          }
        });
      }
      function F(e) {
        let t = B(),
          n = N(e) ? I(e) : e;
        return (
          ["transform", "translate", "scale", "rotate", "perspective"].some(
            (e) => !!n[e] && "none" !== n[e]
          ) ||
          (!!n.containerType && "normal" !== n.containerType) ||
          (!t && !!n.backdropFilter && "none" !== n.backdropFilter) ||
          (!t && !!n.filter && "none" !== n.filter) ||
          ["transform", "translate", "scale", "rotate", "perspective", "filter"].some((e) =>
            (n.willChange || "").includes(e)
          ) ||
          ["paint", "layout", "strict", "content"].some((e) => (n.contain || "").includes(e))
        );
      }
      function B() {
        return (
          "undefined" != typeof CSS &&
          !!CSS.supports &&
          CSS.supports("-webkit-backdrop-filter", "none")
        );
      }
      function H(e) {
        return ["html", "body", "#document"].includes(S(e));
      }
      function I(e) {
        return P(e).getComputedStyle(e);
      }
      function _(e) {
        return N(e)
          ? { scrollLeft: e.scrollLeft, scrollTop: e.scrollTop }
          : { scrollLeft: e.scrollX, scrollTop: e.scrollY };
      }
      function z(e) {
        if ("html" === S(e)) return e;
        let t = e.assignedSlot || e.parentNode || (M(e) && e.host) || k(e);
        return M(t) ? t.host : t;
      }
      function Y(e, t, n) {
        var r;
        (void 0 === t && (t = []), void 0 === n && (n = !0));
        let o = (function e(t) {
            let n = z(t);
            return H(n)
              ? t.ownerDocument
                ? t.ownerDocument.body
                : t.body
              : D(n) && j(n)
                ? n
                : e(n);
          })(e),
          i = o === (null == (r = e.ownerDocument) ? void 0 : r.body),
          a = P(o);
        if (i) {
          let e = X(a);
          return t.concat(a, a.visualViewport || [], j(o) ? o : [], e && n ? Y(e) : []);
        }
        return t.concat(o, Y(o, [], n));
      }
      function X(e) {
        return e.parent && Object.getPrototypeOf(e.parent) ? e.frameElement : null;
      }
      function $(e) {
        let t = I(e),
          n = parseFloat(t.width) || 0,
          r = parseFloat(t.height) || 0,
          o = D(e),
          i = o ? e.offsetWidth : n,
          l = o ? e.offsetHeight : r,
          u = a(n) !== i || a(r) !== l;
        return (u && ((n = i), (r = l)), { width: n, height: r, $: u });
      }
      function U(e) {
        return N(e) ? e : e.contextElement;
      }
      function V(e) {
        let t = U(e);
        if (!D(t)) return u(1);
        let n = t.getBoundingClientRect(),
          { width: r, height: o, $: i } = $(t),
          l = (i ? a(n.width) : n.width) / r,
          c = (i ? a(n.height) : n.height) / o;
        return (
          (l && Number.isFinite(l)) || (l = 1),
          (c && Number.isFinite(c)) || (c = 1),
          { x: l, y: c }
        );
      }
      let G = u(0);
      function K(e) {
        let t = P(e);
        return B() && t.visualViewport
          ? { x: t.visualViewport.offsetLeft, y: t.visualViewport.offsetTop }
          : G;
      }
      function q(e, t, n, r) {
        var o;
        (void 0 === t && (t = !1), void 0 === n && (n = !1));
        let i = e.getBoundingClientRect(),
          a = U(e),
          l = u(1);
        t && (r ? N(r) && (l = V(r)) : (l = V(e)));
        let c = (void 0 === (o = n) && (o = !1), r && (!o || r === P(a)) && o) ? K(a) : u(0),
          s = (i.left + c.x) / l.x,
          f = (i.top + c.y) / l.y,
          d = i.width / l.x,
          p = i.height / l.y;
        if (a) {
          let e = P(a),
            t = r && N(r) ? P(r) : r,
            n = e,
            o = X(n);
          for (; o && r && t !== n; ) {
            let e = V(o),
              t = o.getBoundingClientRect(),
              r = I(o),
              i = t.left + (o.clientLeft + parseFloat(r.paddingLeft)) * e.x,
              a = t.top + (o.clientTop + parseFloat(r.paddingTop)) * e.y;
            ((s *= e.x),
              (f *= e.y),
              (d *= e.x),
              (p *= e.y),
              (s += i),
              (f += a),
              (o = X((n = P(o)))));
          }
        }
        return b({ width: d, height: p, x: s, y: f });
      }
      function Z(e, t) {
        let n = _(e).scrollLeft;
        return t ? t.left + n : q(k(e)).left + n;
      }
      function Q(e, t, n) {
        void 0 === n && (n = !1);
        let r = e.getBoundingClientRect();
        return { x: r.left + t.scrollLeft - (n ? 0 : Z(e, r)), y: r.top + t.scrollTop };
      }
      function J(e, t, n) {
        let r;
        if ("viewport" === t)
          r = (function (e, t) {
            let n = P(e),
              r = k(e),
              o = n.visualViewport,
              i = r.clientWidth,
              a = r.clientHeight,
              l = 0,
              u = 0;
            if (o) {
              ((i = o.width), (a = o.height));
              let e = B();
              (!e || (e && "fixed" === t)) && ((l = o.offsetLeft), (u = o.offsetTop));
            }
            return { width: i, height: a, x: l, y: u };
          })(e, n);
        else if ("document" === t)
          r = (function (e) {
            let t = k(e),
              n = _(e),
              r = e.ownerDocument.body,
              o = i(t.scrollWidth, t.clientWidth, r.scrollWidth, r.clientWidth),
              a = i(t.scrollHeight, t.clientHeight, r.scrollHeight, r.clientHeight),
              l = -n.scrollLeft + Z(e),
              u = -n.scrollTop;
            return (
              "rtl" === I(r).direction && (l += i(t.clientWidth, r.clientWidth) - o),
              { width: o, height: a, x: l, y: u }
            );
          })(k(e));
        else if (N(t))
          r = (function (e, t) {
            let n = q(e, !0, "fixed" === t),
              r = n.top + e.clientTop,
              o = n.left + e.clientLeft,
              i = D(e) ? V(e) : u(1),
              a = e.clientWidth * i.x,
              l = e.clientHeight * i.y;
            return { width: a, height: l, x: o * i.x, y: r * i.y };
          })(t, n);
        else {
          let n = K(e);
          r = { x: t.x - n.x, y: t.y - n.y, width: t.width, height: t.height };
        }
        return b(r);
      }
      function ee(e) {
        return "static" === I(e).position;
      }
      function et(e, t) {
        if (!D(e) || "fixed" === I(e).position) return null;
        if (t) return t(e);
        let n = e.offsetParent;
        return (k(e) === n && (n = n.ownerDocument.body), n);
      }
      function en(e, t) {
        let n = P(e);
        if (W(e)) return n;
        if (!D(e)) {
          let t = z(e);
          for (; t && !H(t); ) {
            if (N(t) && !ee(t)) return t;
            t = z(t);
          }
          return n;
        }
        let r = et(e, t);
        for (; r && ["table", "td", "th"].includes(S(r)) && ee(r); ) r = et(r, t);
        return r && H(r) && ee(r) && !F(r)
          ? n
          : r ||
              (function (e) {
                let t = z(e);
                for (; D(t) && !H(t); ) {
                  if (F(t)) return t;
                  if (W(t)) break;
                  t = z(t);
                }
                return null;
              })(e) ||
              n;
      }
      let er = async function (e) {
          let t = this.getOffsetParent || en,
            n = this.getDimensions,
            r = await n(e.floating);
          return {
            reference: (function (e, t, n) {
              let r = D(t),
                o = k(t),
                i = "fixed" === n,
                a = q(e, !0, i, t),
                l = { scrollLeft: 0, scrollTop: 0 },
                c = u(0);
              if (r || (!r && !i))
                if ((("body" !== S(t) || j(o)) && (l = _(t)), r)) {
                  let e = q(t, !0, i, t);
                  ((c.x = e.x + t.clientLeft), (c.y = e.y + t.clientTop));
                } else o && (c.x = Z(o));
              let s = !o || r || i ? u(0) : Q(o, l);
              return {
                x: a.left + l.scrollLeft - c.x - s.x,
                y: a.top + l.scrollTop - c.y - s.y,
                width: a.width,
                height: a.height,
              };
            })(e.reference, await t(e.floating), e.strategy),
            floating: { x: 0, y: 0, width: r.width, height: r.height },
          };
        },
        eo = {
          convertOffsetParentRelativeRectToViewportRelativeRect: function (e) {
            let { elements: t, rect: n, offsetParent: r, strategy: o } = e,
              i = "fixed" === o,
              a = k(r),
              l = !!t && W(t.floating);
            if (r === a || (l && i)) return n;
            let c = { scrollLeft: 0, scrollTop: 0 },
              s = u(1),
              f = u(0),
              d = D(r);
            if ((d || (!d && !i)) && (("body" !== S(r) || j(a)) && (c = _(r)), D(r))) {
              let e = q(r);
              ((s = V(r)), (f.x = e.x + r.clientLeft), (f.y = e.y + r.clientTop));
            }
            let p = !a || d || i ? u(0) : Q(a, c, !0);
            return {
              width: n.width * s.x,
              height: n.height * s.y,
              x: n.x * s.x - c.scrollLeft * s.x + f.x + p.x,
              y: n.y * s.y - c.scrollTop * s.y + f.y + p.y,
            };
          },
          getDocumentElement: k,
          getClippingRect: function (e) {
            let { element: t, boundary: n, rootBoundary: r, strategy: a } = e,
              l = [
                ...("clippingAncestors" === n
                  ? W(t)
                    ? []
                    : (function (e, t) {
                        let n = t.get(e);
                        if (n) return n;
                        let r = Y(e, [], !1).filter((e) => N(e) && "body" !== S(e)),
                          o = null,
                          i = "fixed" === I(e).position,
                          a = i ? z(e) : e;
                        for (; N(a) && !H(a); ) {
                          let t = I(a),
                            n = F(a);
                          (n || "fixed" !== t.position || (o = null),
                            (
                              i
                                ? !n && !o
                                : (!n &&
                                    "static" === t.position &&
                                    !!o &&
                                    ["absolute", "fixed"].includes(o.position)) ||
                                  (j(a) &&
                                    !n &&
                                    (function e(t, n) {
                                      let r = z(t);
                                      return (
                                        !(r === n || !N(r) || H(r)) &&
                                        ("fixed" === I(r).position || e(r, n))
                                      );
                                    })(e, a))
                            )
                              ? (r = r.filter((e) => e !== a))
                              : (o = t),
                            (a = z(a)));
                        }
                        return (t.set(e, r), r);
                      })(t, this._c)
                  : [].concat(n)),
                r,
              ],
              u = l[0],
              c = l.reduce(
                (e, n) => {
                  let r = J(t, n, a);
                  return (
                    (e.top = i(r.top, e.top)),
                    (e.right = o(r.right, e.right)),
                    (e.bottom = o(r.bottom, e.bottom)),
                    (e.left = i(r.left, e.left)),
                    e
                  );
                },
                J(t, u, a)
              );
            return { width: c.right - c.left, height: c.bottom - c.top, x: c.left, y: c.top };
          },
          getOffsetParent: en,
          getElementRects: er,
          getClientRects: function (e) {
            return Array.from(e.getClientRects());
          },
          getDimensions: function (e) {
            let { width: t, height: n } = $(e);
            return { width: t, height: n };
          },
          getScale: V,
          isElement: N,
          isRTL: function (e) {
            return "rtl" === I(e).direction;
          },
        };
      function ei(e, t) {
        return e.x === t.x && e.y === t.y && e.width === t.width && e.height === t.height;
      }
      function ea(e, t, n, r) {
        let a;
        void 0 === r && (r = {});
        let {
            ancestorScroll: u = !0,
            ancestorResize: c = !0,
            elementResize: s = "function" == typeof ResizeObserver,
            layoutShift: f = "function" == typeof IntersectionObserver,
            animationFrame: d = !1,
          } = r,
          p = U(e),
          h = u || c ? [...(p ? Y(p) : []), ...Y(t)] : [];
        h.forEach((e) => {
          (u && e.addEventListener("scroll", n, { passive: !0 }),
            c && e.addEventListener("resize", n));
        });
        let m =
            p && f
              ? (function (e, t) {
                  let n,
                    r = null,
                    a = k(e);
                  function u() {
                    var e;
                    (clearTimeout(n), null == (e = r) || e.disconnect(), (r = null));
                  }
                  return (
                    !(function c(s, f) {
                      (void 0 === s && (s = !1), void 0 === f && (f = 1), u());
                      let d = e.getBoundingClientRect(),
                        { left: p, top: h, width: m, height: v } = d;
                      if ((s || t(), !m || !v)) return;
                      let g = l(h),
                        y = l(a.clientWidth - (p + m)),
                        w = {
                          rootMargin:
                            -g +
                            "px " +
                            -y +
                            "px " +
                            -l(a.clientHeight - (h + v)) +
                            "px " +
                            -l(p) +
                            "px",
                          threshold: i(0, o(1, f)) || 1,
                        },
                        b = !0;
                      function x(t) {
                        let r = t[0].intersectionRatio;
                        if (r !== f) {
                          if (!b) return c();
                          r
                            ? c(!1, r)
                            : (n = setTimeout(() => {
                                c(!1, 1e-7);
                              }, 1e3));
                        }
                        (1 !== r || ei(d, e.getBoundingClientRect()) || c(), (b = !1));
                      }
                      try {
                        r = new IntersectionObserver(x, { ...w, root: a.ownerDocument });
                      } catch (e) {
                        r = new IntersectionObserver(x, w);
                      }
                      r.observe(e);
                    })(!0),
                    u
                  );
                })(p, n)
              : null,
          v = -1,
          g = null;
        s &&
          ((g = new ResizeObserver((e) => {
            let [r] = e;
            (r &&
              r.target === p &&
              g &&
              (g.unobserve(t),
              cancelAnimationFrame(v),
              (v = requestAnimationFrame(() => {
                var e;
                null == (e = g) || e.observe(t);
              }))),
              n());
          })),
          p && !d && g.observe(p),
          g.observe(t));
        let y = d ? q(e) : null;
        return (
          d &&
            (function t() {
              let r = q(e);
              (y && !ei(y, r) && n(), (y = r), (a = requestAnimationFrame(t)));
            })(),
          n(),
          () => {
            var e;
            (h.forEach((e) => {
              (u && e.removeEventListener("scroll", n), c && e.removeEventListener("resize", n));
            }),
              null == m || m(),
              null == (e = g) || e.disconnect(),
              (g = null),
              d && cancelAnimationFrame(a));
          }
        );
      }
      let el = function (e) {
          return (
            void 0 === e && (e = 0),
            {
              name: "offset",
              options: e,
              async fn(t) {
                var n, r;
                let { x: o, y: i, placement: a, middlewareData: l } = t,
                  u = await L(t, e);
                return a === (null == (n = l.offset) ? void 0 : n.placement) &&
                  null != (r = l.arrow) &&
                  r.alignmentOffset
                  ? {}
                  : { x: o + u.x, y: i + u.y, data: { ...u, placement: a } };
              },
            }
          );
        },
        eu = function (e) {
          return (
            void 0 === e && (e = {}),
            {
              name: "shift",
              options: e,
              async fn(t) {
                let { x: n, y: r, placement: a } = t,
                  {
                    mainAxis: l = !0,
                    crossAxis: u = !1,
                    limiter: c = {
                      fn: (e) => {
                        let { x: t, y: n } = e;
                        return { x: t, y: n };
                      },
                    },
                    ...s
                  } = f(e, t),
                  p = { x: n, y: r },
                  m = await C(t, s),
                  g = v(d(a)),
                  y = h(g),
                  w = p[y],
                  b = p[g];
                if (l) {
                  let e = "y" === y ? "top" : "left",
                    t = "y" === y ? "bottom" : "right",
                    n = w + m[e],
                    r = w - m[t];
                  w = i(n, o(w, r));
                }
                if (u) {
                  let e = "y" === g ? "top" : "left",
                    t = "y" === g ? "bottom" : "right",
                    n = b + m[e],
                    r = b - m[t];
                  b = i(n, o(b, r));
                }
                let x = c.fn({ ...t, [y]: w, [g]: b });
                return { ...x, data: { x: x.x - n, y: x.y - r, enabled: { [y]: l, [g]: u } } };
              },
            }
          );
        },
        ec = function (e) {
          return (
            void 0 === e && (e = {}),
            {
              name: "flip",
              options: e,
              async fn(t) {
                var n, r, o, i, a;
                let {
                    placement: l,
                    middlewareData: u,
                    rects: c,
                    initialPlacement: s,
                    platform: w,
                    elements: b,
                  } = t,
                  {
                    mainAxis: x = !0,
                    crossAxis: E = !0,
                    fallbackPlacements: R,
                    fallbackStrategy: T = "bestFit",
                    fallbackAxisSideDirection: L = "none",
                    flipAlignment: A = !0,
                    ...S
                  } = f(e, t);
                if (null != (n = u.arrow) && n.alignmentOffset) return {};
                let P = d(l),
                  k = v(s),
                  O = d(s) === s,
                  N = await (null == w.isRTL ? void 0 : w.isRTL(b.floating)),
                  D =
                    R ||
                    (O || !A
                      ? [y(s)]
                      : (function (e) {
                          let t = y(e);
                          return [g(e), t, g(t)];
                        })(s)),
                  M = "none" !== L;
                !R &&
                  M &&
                  D.push(
                    ...(function (e, t, n, r) {
                      let o = p(e),
                        i = (function (e, t, n) {
                          let r = ["left", "right"],
                            o = ["right", "left"];
                          switch (e) {
                            case "top":
                            case "bottom":
                              if (n) return t ? o : r;
                              return t ? r : o;
                            case "left":
                            case "right":
                              return t ? ["top", "bottom"] : ["bottom", "top"];
                            default:
                              return [];
                          }
                        })(d(e), "start" === n, r);
                      return (
                        o && ((i = i.map((e) => e + "-" + o)), t && (i = i.concat(i.map(g)))),
                        i
                      );
                    })(s, A, L, N)
                  );
                let j = [s, ...D],
                  W = await C(t, S),
                  F = [],
                  B = (null == (r = u.flip) ? void 0 : r.overflows) || [];
                if ((x && F.push(W[P]), E)) {
                  let e = (function (e, t, n) {
                    void 0 === n && (n = !1);
                    let r = p(e),
                      o = h(v(e)),
                      i = m(o),
                      a =
                        "x" === o
                          ? r === (n ? "end" : "start")
                            ? "right"
                            : "left"
                          : "start" === r
                            ? "bottom"
                            : "top";
                    return (t.reference[i] > t.floating[i] && (a = y(a)), [a, y(a)]);
                  })(l, c, N);
                  F.push(W[e[0]], W[e[1]]);
                }
                if (((B = [...B, { placement: l, overflows: F }]), !F.every((e) => e <= 0))) {
                  let e = ((null == (o = u.flip) ? void 0 : o.index) || 0) + 1,
                    t = j[e];
                  if (t) return { data: { index: e, overflows: B }, reset: { placement: t } };
                  let n =
                    null ==
                    (i = B.filter((e) => e.overflows[0] <= 0).sort(
                      (e, t) => e.overflows[1] - t.overflows[1]
                    )[0])
                      ? void 0
                      : i.placement;
                  if (!n)
                    switch (T) {
                      case "bestFit": {
                        let e =
                          null ==
                          (a = B.filter((e) => {
                            if (M) {
                              let t = v(e.placement);
                              return t === k || "y" === t;
                            }
                            return !0;
                          })
                            .map((e) => [
                              e.placement,
                              e.overflows.filter((e) => e > 0).reduce((e, t) => e + t, 0),
                            ])
                            .sort((e, t) => e[1] - t[1])[0])
                            ? void 0
                            : a[0];
                        e && (n = e);
                        break;
                      }
                      case "initialPlacement":
                        n = s;
                    }
                  if (l !== n) return { reset: { placement: n } };
                }
                return {};
              },
            }
          );
        },
        es = function (e) {
          return (
            void 0 === e && (e = {}),
            {
              name: "size",
              options: e,
              async fn(t) {
                var n, r;
                let a,
                  l,
                  { placement: u, rects: c, platform: s, elements: h } = t,
                  { apply: m = () => {}, ...g } = f(e, t),
                  y = await C(t, g),
                  w = d(u),
                  b = p(u),
                  x = "y" === v(u),
                  { width: E, height: R } = c.floating;
                "top" === w || "bottom" === w
                  ? ((a = w),
                    (l =
                      b ===
                      ((await (null == s.isRTL ? void 0 : s.isRTL(h.floating))) ? "start" : "end")
                        ? "left"
                        : "right"))
                  : ((l = w), (a = "end" === b ? "top" : "bottom"));
                let T = R - y.top - y.bottom,
                  L = E - y.left - y.right,
                  A = o(R - y[a], T),
                  S = o(E - y[l], L),
                  P = !t.middlewareData.shift,
                  k = A,
                  O = S;
                if (
                  (null != (n = t.middlewareData.shift) && n.enabled.x && (O = L),
                  null != (r = t.middlewareData.shift) && r.enabled.y && (k = T),
                  P && !b)
                ) {
                  let e = i(y.left, 0),
                    t = i(y.right, 0),
                    n = i(y.top, 0),
                    r = i(y.bottom, 0);
                  x
                    ? (O = E - 2 * (0 !== e || 0 !== t ? e + t : i(y.left, y.right)))
                    : (k = R - 2 * (0 !== n || 0 !== r ? n + r : i(y.top, y.bottom)));
                }
                await m({ ...t, availableWidth: O, availableHeight: k });
                let N = await s.getDimensions(h.floating);
                return E !== N.width || R !== N.height ? { reset: { rects: !0 } } : {};
              },
            }
          );
        },
        ef = function (e) {
          return (
            void 0 === e && (e = {}),
            {
              name: "hide",
              options: e,
              async fn(t) {
                let { rects: n } = t,
                  { strategy: r = "referenceHidden", ...o } = f(e, t);
                switch (r) {
                  case "referenceHidden": {
                    let e = R(await C(t, { ...o, elementContext: "reference" }), n.reference);
                    return { data: { referenceHiddenOffsets: e, referenceHidden: T(e) } };
                  }
                  case "escaped": {
                    let e = R(await C(t, { ...o, altBoundary: !0 }), n.floating);
                    return { data: { escapedOffsets: e, escaped: T(e) } };
                  }
                  default:
                    return {};
                }
              },
            }
          );
        },
        ed = (e) => ({
          name: "arrow",
          options: e,
          async fn(t) {
            let {
                x: n,
                y: r,
                placement: a,
                rects: l,
                platform: u,
                elements: c,
                middlewareData: s,
              } = t,
              { element: d, padding: g = 0 } = f(e, t) || {};
            if (null == d) return {};
            let y = w(g),
              b = { x: n, y: r },
              x = h(v(a)),
              E = m(x),
              C = await u.getDimensions(d),
              R = "y" === x,
              T = R ? "clientHeight" : "clientWidth",
              L = l.reference[E] + l.reference[x] - b[x] - l.floating[E],
              A = b[x] - l.reference[x],
              S = await (null == u.getOffsetParent ? void 0 : u.getOffsetParent(d)),
              P = S ? S[T] : 0;
            (P && (await (null == u.isElement ? void 0 : u.isElement(S)))) ||
              (P = c.floating[T] || l.floating[E]);
            let k = P / 2 - C[E] / 2 - 1,
              O = o(y[R ? "top" : "left"], k),
              N = o(y[R ? "bottom" : "right"], k),
              D = P - C[E] - N,
              M = P / 2 - C[E] / 2 + (L / 2 - A / 2),
              j = i(O, o(M, D)),
              W =
                !s.arrow &&
                null != p(a) &&
                M !== j &&
                l.reference[E] / 2 - (M < O ? O : N) - C[E] / 2 < 0,
              F = W ? (M < O ? M - O : M - D) : 0;
            return {
              [x]: b[x] + F,
              data: { [x]: j, centerOffset: M - j - F, ...(W && { alignmentOffset: F }) },
              reset: W,
            };
          },
        }),
        ep = function (e) {
          return (
            void 0 === e && (e = {}),
            {
              options: e,
              fn(t) {
                let { x: n, y: r, placement: o, rects: i, middlewareData: a } = t,
                  { offset: l = 0, mainAxis: u = !0, crossAxis: c = !0 } = f(e, t),
                  s = { x: n, y: r },
                  p = v(o),
                  m = h(p),
                  g = s[m],
                  y = s[p],
                  w = f(l, t),
                  b =
                    "number" == typeof w
                      ? { mainAxis: w, crossAxis: 0 }
                      : { mainAxis: 0, crossAxis: 0, ...w };
                if (u) {
                  let e = "y" === m ? "height" : "width",
                    t = i.reference[m] - i.floating[e] + b.mainAxis,
                    n = i.reference[m] + i.reference[e] - b.mainAxis;
                  g < t ? (g = t) : g > n && (g = n);
                }
                if (c) {
                  var x, E;
                  let e = "y" === m ? "width" : "height",
                    t = ["top", "left"].includes(d(o)),
                    n =
                      i.reference[p] -
                      i.floating[e] +
                      ((t && (null == (x = a.offset) ? void 0 : x[p])) || 0) +
                      (t ? 0 : b.crossAxis),
                    r =
                      i.reference[p] +
                      i.reference[e] +
                      (t ? 0 : (null == (E = a.offset) ? void 0 : E[p]) || 0) -
                      (t ? b.crossAxis : 0);
                  y < n ? (y = n) : y > r && (y = r);
                }
                return { [m]: g, [p]: y };
              },
            }
          );
        },
        eh = (e, t, n) => {
          let r = new Map(),
            o = { platform: eo, ...n },
            i = { ...o.platform, _c: r };
          return E(e, t, { ...o, platform: i });
        };
    },
    69666: (e, t, n) => {
      n.d(t, { n: () => f });
      var r = n(12115),
        o = n(94446),
        i = n(97602),
        a = n(70222),
        l = n(95155),
        u = "focusScope.autoFocusOnMount",
        c = "focusScope.autoFocusOnUnmount",
        s = { bubbles: !1, cancelable: !0 },
        f = r.forwardRef((e, t) => {
          let {
              loop: n = !1,
              trapped: f = !1,
              onMountAutoFocus: v,
              onUnmountAutoFocus: g,
              ...y
            } = e,
            [w, b] = r.useState(null),
            x = (0, a.c)(v),
            E = (0, a.c)(g),
            C = r.useRef(null),
            R = (0, o.s)(t, (e) => b(e)),
            T = r.useRef({
              paused: !1,
              pause() {
                this.paused = !0;
              },
              resume() {
                this.paused = !1;
              },
            }).current;
          (r.useEffect(() => {
            if (f) {
              let e = function (e) {
                  if (T.paused || !w) return;
                  let t = e.target;
                  w.contains(t) ? (C.current = t) : h(C.current, { select: !0 });
                },
                t = function (e) {
                  if (T.paused || !w) return;
                  let t = e.relatedTarget;
                  null !== t && (w.contains(t) || h(C.current, { select: !0 }));
                };
              (document.addEventListener("focusin", e), document.addEventListener("focusout", t));
              let n = new MutationObserver(function (e) {
                if (document.activeElement === document.body)
                  for (let t of e) t.removedNodes.length > 0 && h(w);
              });
              return (
                w && n.observe(w, { childList: !0, subtree: !0 }),
                () => {
                  (document.removeEventListener("focusin", e),
                    document.removeEventListener("focusout", t),
                    n.disconnect());
                }
              );
            }
          }, [f, w, T.paused]),
            r.useEffect(() => {
              if (w) {
                m.add(T);
                let e = document.activeElement;
                if (!w.contains(e)) {
                  let t = new CustomEvent(u, s);
                  (w.addEventListener(u, x),
                    w.dispatchEvent(t),
                    t.defaultPrevented ||
                      ((function (e) {
                        let { select: t = !1 } =
                            arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
                          n = document.activeElement;
                        for (let r of e)
                          if ((h(r, { select: t }), document.activeElement !== n)) return;
                      })(
                        d(w).filter((e) => "A" !== e.tagName),
                        { select: !0 }
                      ),
                      document.activeElement === e && h(w)));
                }
                return () => {
                  (w.removeEventListener(u, x),
                    setTimeout(() => {
                      let t = new CustomEvent(c, s);
                      (w.addEventListener(c, E),
                        w.dispatchEvent(t),
                        t.defaultPrevented || h(e ?? document.body, { select: !0 }),
                        w.removeEventListener(c, E),
                        m.remove(T));
                    }, 0));
                };
              }
            }, [w, x, E, T]));
          let L = r.useCallback(
            (e) => {
              if ((!n && !f) || T.paused) return;
              let t = "Tab" === e.key && !e.altKey && !e.ctrlKey && !e.metaKey,
                r = document.activeElement;
              if (t && r) {
                let t = e.currentTarget,
                  [o, i] = (function (e) {
                    let t = d(e);
                    return [p(t, e), p(t.reverse(), e)];
                  })(t);
                o && i
                  ? e.shiftKey || r !== i
                    ? e.shiftKey && r === o && (e.preventDefault(), n && h(i, { select: !0 }))
                    : (e.preventDefault(), n && h(o, { select: !0 }))
                  : r === t && e.preventDefault();
              }
            },
            [n, f, T.paused]
          );
          return (0, l.jsx)(i.sG.div, { tabIndex: -1, ...y, ref: R, onKeyDown: L });
        });
      function d(e) {
        let t = [],
          n = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
            acceptNode: (e) => {
              let t = "INPUT" === e.tagName && "hidden" === e.type;
              return e.disabled || e.hidden || t
                ? NodeFilter.FILTER_SKIP
                : e.tabIndex >= 0
                  ? NodeFilter.FILTER_ACCEPT
                  : NodeFilter.FILTER_SKIP;
            },
          });
        for (; n.nextNode(); ) t.push(n.currentNode);
        return t;
      }
      function p(e, t) {
        for (let n of e)
          if (
            !(function (e, t) {
              let { upTo: n } = t;
              if ("hidden" === getComputedStyle(e).visibility) return !0;
              for (; e && (void 0 === n || e !== n); ) {
                if ("none" === getComputedStyle(e).display) return !0;
                e = e.parentElement;
              }
              return !1;
            })(n, { upTo: t })
          )
            return n;
      }
      function h(e) {
        let { select: t = !1 } =
          arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
        if (e && e.focus) {
          var n;
          let r = document.activeElement;
          (e.focus({ preventScroll: !0 }),
            e !== r && (n = e) instanceof HTMLInputElement && "select" in n && t && e.select());
        }
      }
      f.displayName = "FocusScope";
      var m = (function () {
        let e = [];
        return {
          add(t) {
            let n = e[0];
            (t !== n && n?.pause(), (e = v(e, t)).unshift(t));
          },
          remove(t) {
            ((e = v(e, t)), e[0]?.resume());
          },
        };
      })();
      function v(e, t) {
        let n = [...e],
          r = n.indexOf(t);
        return (-1 !== r && n.splice(r, 1), n);
      }
    },
    70222: (e, t, n) => {
      n.d(t, { c: () => o });
      var r = n(12115);
      function o(e) {
        let t = r.useRef(e);
        return (
          r.useEffect(() => {
            t.current = e;
          }),
          r.useMemo(
            () =>
              (...e) =>
                t.current?.(...e),
            []
          )
        );
      }
    },
    73867: (e, t, n) => {
      n.d(t, { Mz: () => B, i3: () => I, UC: () => H, bL: () => F, Bk: () => x });
      var r = n(12115),
        o = n(58146),
        i = n(47650),
        a = "undefined" != typeof document ? r.useLayoutEffect : r.useEffect;
      function l(e, t) {
        let n, r, o;
        if (e === t) return !0;
        if (typeof e != typeof t) return !1;
        if ("function" == typeof e && e.toString() === t.toString()) return !0;
        if (e && t && "object" == typeof e) {
          if (Array.isArray(e)) {
            if ((n = e.length) !== t.length) return !1;
            for (r = n; 0 != r--; ) if (!l(e[r], t[r])) return !1;
            return !0;
          }
          if ((n = (o = Object.keys(e)).length) !== Object.keys(t).length) return !1;
          for (r = n; 0 != r--; ) if (!{}.hasOwnProperty.call(t, o[r])) return !1;
          for (r = n; 0 != r--; ) {
            let n = o[r];
            if (("_owner" !== n || !e.$$typeof) && !l(e[n], t[n])) return !1;
          }
          return !0;
        }
        return e != e && t != t;
      }
      function u(e) {
        return "undefined" == typeof window
          ? 1
          : (e.ownerDocument.defaultView || window).devicePixelRatio || 1;
      }
      function c(e, t) {
        let n = u(e);
        return Math.round(t * n) / n;
      }
      function s(e) {
        let t = r.useRef(e);
        return (
          a(() => {
            t.current = e;
          }),
          t
        );
      }
      var f = n(97602),
        d = n(95155),
        p = r.forwardRef((e, t) => {
          let { children: n, width: r = 10, height: o = 5, ...i } = e;
          return (0, d.jsx)(f.sG.svg, {
            ...i,
            ref: t,
            width: r,
            height: o,
            viewBox: "0 0 30 10",
            preserveAspectRatio: "none",
            children: e.asChild ? n : (0, d.jsx)("polygon", { points: "0,0 30,0 15,10" }),
          });
        });
      p.displayName = "Arrow";
      var h = n(94446),
        m = n(3468),
        v = n(70222),
        g = n(4129),
        y = n(84288),
        w = "Popper",
        [b, x] = (0, m.A)(w),
        [E, C] = b(w),
        R = (e) => {
          let { __scopePopper: t, children: n } = e,
            [o, i] = r.useState(null);
          return (0, d.jsx)(E, { scope: t, anchor: o, onAnchorChange: i, children: n });
        };
      R.displayName = w;
      var T = "PopperAnchor",
        L = r.forwardRef((e, t) => {
          let { __scopePopper: n, virtualRef: o, ...i } = e,
            a = C(T, n),
            l = r.useRef(null),
            u = (0, h.s)(t, l);
          return (
            r.useEffect(() => {
              a.onAnchorChange(o?.current || l.current);
            }),
            o ? null : (0, d.jsx)(f.sG.div, { ...i, ref: u })
          );
        });
      L.displayName = T;
      var A = "PopperContent",
        [S, P] = b(A),
        k = r.forwardRef((e, t) => {
          let {
              __scopePopper: n,
              side: p = "bottom",
              sideOffset: m = 0,
              align: w = "center",
              alignOffset: b = 0,
              arrowPadding: x = 0,
              avoidCollisions: E = !0,
              collisionBoundary: R = [],
              collisionPadding: T = 0,
              sticky: L = "partial",
              hideWhenDetached: P = !1,
              updatePositionStrategy: k = "optimized",
              onPlaced: O,
              ...N
            } = e,
            D = C(A, n),
            [F, B] = r.useState(null),
            H = (0, h.s)(t, (e) => B(e)),
            [I, _] = r.useState(null),
            z = (0, y.X)(I),
            Y = z?.width ?? 0,
            X = z?.height ?? 0,
            $ = "number" == typeof T ? T : { top: 0, right: 0, bottom: 0, left: 0, ...T },
            U = Array.isArray(R) ? R : [R],
            V = U.length > 0,
            G = { padding: $, boundary: U.filter(M), altBoundary: V },
            {
              refs: K,
              floatingStyles: q,
              placement: Z,
              isPositioned: Q,
              middlewareData: J,
            } = (function (e) {
              void 0 === e && (e = {});
              let {
                  placement: t = "bottom",
                  strategy: n = "absolute",
                  middleware: f = [],
                  platform: d,
                  elements: { reference: p, floating: h } = {},
                  transform: m = !0,
                  whileElementsMounted: v,
                  open: g,
                } = e,
                [y, w] = r.useState({
                  x: 0,
                  y: 0,
                  strategy: n,
                  placement: t,
                  middlewareData: {},
                  isPositioned: !1,
                }),
                [b, x] = r.useState(f);
              l(b, f) || x(f);
              let [E, C] = r.useState(null),
                [R, T] = r.useState(null),
                L = r.useCallback((e) => {
                  e !== k.current && ((k.current = e), C(e));
                }, []),
                A = r.useCallback((e) => {
                  e !== O.current && ((O.current = e), T(e));
                }, []),
                S = p || E,
                P = h || R,
                k = r.useRef(null),
                O = r.useRef(null),
                N = r.useRef(y),
                D = null != v,
                M = s(v),
                j = s(d),
                W = s(g),
                F = r.useCallback(() => {
                  if (!k.current || !O.current) return;
                  let e = { placement: t, strategy: n, middleware: b };
                  (j.current && (e.platform = j.current),
                    (0, o.rD)(k.current, O.current, e).then((e) => {
                      let t = { ...e, isPositioned: !1 !== W.current };
                      B.current &&
                        !l(N.current, t) &&
                        ((N.current = t),
                        i.flushSync(() => {
                          w(t);
                        }));
                    }));
                }, [b, t, n, j, W]);
              a(() => {
                !1 === g &&
                  N.current.isPositioned &&
                  ((N.current.isPositioned = !1), w((e) => ({ ...e, isPositioned: !1 })));
              }, [g]);
              let B = r.useRef(!1);
              (a(
                () => (
                  (B.current = !0),
                  () => {
                    B.current = !1;
                  }
                ),
                []
              ),
                a(() => {
                  if ((S && (k.current = S), P && (O.current = P), S && P)) {
                    if (M.current) return M.current(S, P, F);
                    F();
                  }
                }, [S, P, F, M, D]));
              let H = r.useMemo(
                  () => ({ reference: k, floating: O, setReference: L, setFloating: A }),
                  [L, A]
                ),
                I = r.useMemo(() => ({ reference: S, floating: P }), [S, P]),
                _ = r.useMemo(() => {
                  let e = { position: n, left: 0, top: 0 };
                  if (!I.floating) return e;
                  let t = c(I.floating, y.x),
                    r = c(I.floating, y.y);
                  return m
                    ? {
                        ...e,
                        transform: "translate(" + t + "px, " + r + "px)",
                        ...(u(I.floating) >= 1.5 && { willChange: "transform" }),
                      }
                    : { position: n, left: t, top: r };
                }, [n, m, I.floating, y.x, y.y]);
              return r.useMemo(
                () => ({ ...y, update: F, refs: H, elements: I, floatingStyles: _ }),
                [y, F, H, I, _]
              );
            })({
              strategy: "fixed",
              placement: p + ("center" !== w ? "-" + w : ""),
              whileElementsMounted: function () {
                for (var e = arguments.length, t = Array(e), n = 0; n < e; n++) t[n] = arguments[n];
                return (0, o.ll)(...t, { animationFrame: "always" === k });
              },
              elements: { reference: D.anchor },
              middleware: [
                ((e, t) => ({ ...(0, o.cY)(e), options: [e, t] }))({
                  mainAxis: m + X,
                  alignmentAxis: b,
                }),
                E &&
                  ((e, t) => ({ ...(0, o.BN)(e), options: [e, t] }))({
                    mainAxis: !0,
                    crossAxis: !1,
                    limiter:
                      "partial" === L
                        ? ((e, t) => ({ ...(0, o.ER)(e), options: [e, t] }))()
                        : void 0,
                    ...G,
                  }),
                E && ((e, t) => ({ ...(0, o.UU)(e), options: [e, t] }))({ ...G }),
                ((e, t) => ({ ...(0, o.Ej)(e), options: [e, t] }))({
                  ...G,
                  apply: (e) => {
                    let { elements: t, rects: n, availableWidth: r, availableHeight: o } = e,
                      { width: i, height: a } = n.reference,
                      l = t.floating.style;
                    (l.setProperty("--radix-popper-available-width", `${r}px`),
                      l.setProperty("--radix-popper-available-height", `${o}px`),
                      l.setProperty("--radix-popper-anchor-width", `${i}px`),
                      l.setProperty("--radix-popper-anchor-height", `${a}px`));
                  },
                }),
                I &&
                  ((e, t) => ({
                    ...((e) => ({
                      name: "arrow",
                      options: e,
                      fn(t) {
                        let { element: n, padding: r } = "function" == typeof e ? e(t) : e;
                        return n && {}.hasOwnProperty.call(n, "current")
                          ? null != n.current
                            ? (0, o.UE)({ element: n.current, padding: r }).fn(t)
                            : {}
                          : n
                            ? (0, o.UE)({ element: n, padding: r }).fn(t)
                            : {};
                      },
                    }))(e),
                    options: [e, t],
                  }))({ element: I, padding: x }),
                j({ arrowWidth: Y, arrowHeight: X }),
                P &&
                  ((e, t) => ({ ...(0, o.jD)(e), options: [e, t] }))({
                    strategy: "referenceHidden",
                    ...G,
                  }),
              ],
            }),
            [ee, et] = W(Z),
            en = (0, v.c)(O);
          (0, g.N)(() => {
            Q && en?.();
          }, [Q, en]);
          let er = J.arrow?.x,
            eo = J.arrow?.y,
            ei = J.arrow?.centerOffset !== 0,
            [ea, el] = r.useState();
          return (
            (0, g.N)(() => {
              F && el(window.getComputedStyle(F).zIndex);
            }, [F]),
            (0, d.jsx)("div", {
              ref: K.setFloating,
              "data-radix-popper-content-wrapper": "",
              style: {
                ...q,
                transform: Q ? q.transform : "translate(0, -200%)",
                minWidth: "max-content",
                zIndex: ea,
                "--radix-popper-transform-origin": [
                  J.transformOrigin?.x,
                  J.transformOrigin?.y,
                ].join(" "),
                ...(J.hide?.referenceHidden && { visibility: "hidden", pointerEvents: "none" }),
              },
              dir: e.dir,
              children: (0, d.jsx)(S, {
                scope: n,
                placedSide: ee,
                onArrowChange: _,
                arrowX: er,
                arrowY: eo,
                shouldHideArrow: ei,
                children: (0, d.jsx)(f.sG.div, {
                  "data-side": ee,
                  "data-align": et,
                  ...N,
                  ref: H,
                  style: { ...N.style, animation: Q ? void 0 : "none" },
                }),
              }),
            })
          );
        });
      k.displayName = A;
      var O = "PopperArrow",
        N = { top: "bottom", right: "left", bottom: "top", left: "right" },
        D = r.forwardRef(function (e, t) {
          let { __scopePopper: n, ...r } = e,
            o = P(O, n),
            i = N[o.placedSide];
          return (0, d.jsx)("span", {
            ref: o.onArrowChange,
            style: {
              position: "absolute",
              left: o.arrowX,
              top: o.arrowY,
              [i]: 0,
              transformOrigin: { top: "", right: "0 0", bottom: "center 0", left: "100% 0" }[
                o.placedSide
              ],
              transform: {
                top: "translateY(100%)",
                right: "translateY(50%) rotate(90deg) translateX(-50%)",
                bottom: "rotate(180deg)",
                left: "translateY(50%) rotate(-90deg) translateX(50%)",
              }[o.placedSide],
              visibility: o.shouldHideArrow ? "hidden" : void 0,
            },
            children: (0, d.jsx)(p, { ...r, ref: t, style: { ...r.style, display: "block" } }),
          });
        });
      function M(e) {
        return null !== e;
      }
      D.displayName = O;
      var j = (e) => ({
        name: "transformOrigin",
        options: e,
        fn(t) {
          let { placement: n, rects: r, middlewareData: o } = t,
            i = o.arrow?.centerOffset !== 0,
            a = i ? 0 : e.arrowWidth,
            l = i ? 0 : e.arrowHeight,
            [u, c] = W(n),
            s = { start: "0%", center: "50%", end: "100%" }[c],
            f = (o.arrow?.x ?? 0) + a / 2,
            d = (o.arrow?.y ?? 0) + l / 2,
            p = "",
            h = "";
          return (
            "bottom" === u
              ? ((p = i ? s : `${f}px`), (h = `${-l}px`))
              : "top" === u
                ? ((p = i ? s : `${f}px`), (h = `${r.floating.height + l}px`))
                : "right" === u
                  ? ((p = `${-l}px`), (h = i ? s : `${d}px`))
                  : "left" === u && ((p = `${r.floating.width + l}px`), (h = i ? s : `${d}px`)),
            { data: { x: p, y: h } }
          );
        },
      });
      function W(e) {
        let [t, n = "center"] = e.split("-");
        return [t, n];
      }
      var F = R,
        B = L,
        H = k,
        I = D;
    },
    75433: (e, t, n) => {
      (n.r(t), n.d(t, { Portal: () => u, Root: () => c }));
      var r = n(12115),
        o = n(47650),
        i = n(97602),
        a = n(4129),
        l = n(95155),
        u = r.forwardRef((e, t) => {
          let { container: n, ...u } = e,
            [c, s] = r.useState(!1);
          (0, a.N)(() => s(!0), []);
          let f = n || (c && globalThis?.document?.body);
          return f ? o.createPortal((0, l.jsx)(i.sG.div, { ...u, ref: t }), f) : null;
        });
      u.displayName = "Portal";
      var c = u;
    },
    84288: (e, t, n) => {
      n.d(t, { X: () => i });
      var r = n(12115),
        o = n(4129);
      function i(e) {
        let [t, n] = r.useState(void 0);
        return (
          (0, o.N)(() => {
            if (e) {
              n({ width: e.offsetWidth, height: e.offsetHeight });
              let t = new ResizeObserver((t) => {
                let r, o;
                if (!Array.isArray(t) || !t.length) return;
                let i = t[0];
                if ("borderBoxSize" in i) {
                  let e = i.borderBoxSize,
                    t = Array.isArray(e) ? e[0] : e;
                  ((r = t.inlineSize), (o = t.blockSize));
                } else ((r = e.offsetWidth), (o = e.offsetHeight));
                n({ width: r, height: o });
              });
              return (t.observe(e, { box: "border-box" }), () => t.unobserve(e));
            }
            n(void 0);
          }, [e]),
          t
        );
      }
    },
    97745: (e, t, n) => {
      n.d(t, { Eq: () => c });
      var r = new WeakMap(),
        o = new WeakMap(),
        i = {},
        a = 0,
        l = function (e) {
          return e && (e.host || l(e.parentNode));
        },
        u = function (e, t, n, u) {
          var c = (Array.isArray(e) ? e : [e])
            .map(function (e) {
              if (t.contains(e)) return e;
              var n = l(e);
              return n && t.contains(n)
                ? n
                : (console.error("aria-hidden", e, "in not contained inside", t, ". Doing nothing"),
                  null);
            })
            .filter(function (e) {
              return !!e;
            });
          i[n] || (i[n] = new WeakMap());
          var s = i[n],
            f = [],
            d = new Set(),
            p = new Set(c),
            h = function (e) {
              !e || d.has(e) || (d.add(e), h(e.parentNode));
            };
          c.forEach(h);
          var m = function (e) {
            !e ||
              p.has(e) ||
              Array.prototype.forEach.call(e.children, function (e) {
                if (d.has(e)) m(e);
                else
                  try {
                    var t = e.getAttribute(u),
                      i = null !== t && "false" !== t,
                      a = (r.get(e) || 0) + 1,
                      l = (s.get(e) || 0) + 1;
                    (r.set(e, a),
                      s.set(e, l),
                      f.push(e),
                      1 === a && i && o.set(e, !0),
                      1 === l && e.setAttribute(n, "true"),
                      i || e.setAttribute(u, "true"));
                  } catch (t) {
                    console.error("aria-hidden: cannot operate on ", e, t);
                  }
              });
          };
          return (
            m(t),
            d.clear(),
            a++,
            function () {
              (f.forEach(function (e) {
                var t = r.get(e) - 1,
                  i = s.get(e) - 1;
                (r.set(e, t),
                  s.set(e, i),
                  t || (o.has(e) || e.removeAttribute(u), o.delete(e)),
                  i || e.removeAttribute(n));
              }),
                --a || ((r = new WeakMap()), (r = new WeakMap()), (o = new WeakMap()), (i = {})));
            }
          );
        },
        c = function (e, t, n) {
          void 0 === n && (n = "data-aria-hidden");
          var r = Array.from(Array.isArray(e) ? e : [e]),
            o =
              t ||
              ("undefined" == typeof document
                ? null
                : (Array.isArray(e) ? e[0] : e).ownerDocument.body);
          return o
            ? (r.push.apply(r, Array.from(o.querySelectorAll("[aria-live], script"))),
              u(r, o, n, "aria-hidden"))
            : function () {
                return null;
              };
        };
    },
  },
]);
