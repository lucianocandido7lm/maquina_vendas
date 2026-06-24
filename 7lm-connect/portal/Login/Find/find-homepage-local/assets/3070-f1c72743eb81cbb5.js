"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [3070],
  {
    33070: (e, t, r) => {
      r.d(t, { HG: () => I, K9: () => k });
      var n,
        a = r(12115);
      function u(e, t) {
        var r = {};
        for (var n in e)
          Object.prototype.hasOwnProperty.call(e, n) && 0 > t.indexOf(n) && (r[n] = e[n]);
        if (null != e && "function" == typeof Object.getOwnPropertySymbols)
          for (var a = 0, n = Object.getOwnPropertySymbols(e); a < n.length; a++)
            0 > t.indexOf(n[a]) &&
              Object.prototype.propertyIsEnumerable.call(e, n[a]) &&
              (r[n[a]] = e[n[a]]);
        return r;
      }
      function o() {}
      function i(e) {
        return !!(e || "").match(/\d/);
      }
      function l(e) {
        return null == e;
      }
      function c(e) {
        return l(e) || ("number" == typeof e && isNaN(e)) || ("number" == typeof e && !isFinite(e));
      }
      function s(e) {
        return e.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
      }
      function f(e, t) {
        void 0 === t && (t = !0);
        var r = "-" === e[0],
          n = r && t,
          a = (e = e.replace("-", "")).split(".");
        return { beforeDecimal: a[0], afterDecimal: a[1] || "", hasNegation: r, addNegation: n };
      }
      function v(e, t, r) {
        for (var n = "", a = r ? "0" : "", u = 0; u <= t - 1; u++) n += e[u] || a;
        return n;
      }
      function d(e, t) {
        return Array(t + 1).join(e);
      }
      function g(e) {
        var t = e + "",
          r = "-" === t[0] ? "-" : "";
        r && (t = t.substring(1));
        var n = t.split(/[eE]/g),
          a = n[0],
          u = n[1];
        if (!(u = Number(u))) return r + a;
        a = a.replace(".", "");
        var o = 1 + u,
          i = a.length;
        return (
          o < 0
            ? (a = "0." + d("0", Math.abs(o)) + a)
            : o >= i
              ? (a += d("0", o - i))
              : (a = (a.substring(0, o) || "0") + "." + a.substring(o)),
          r + a
        );
      }
      function m(e, t, r) {
        if (-1 !== ["", "-"].indexOf(e)) return e;
        var n = (-1 !== e.indexOf(".") || r) && t,
          a = f(e),
          u = a.beforeDecimal,
          o = a.afterDecimal,
          i = a.hasNegation,
          l = parseFloat("0." + (o || "0")),
          c = (o.length <= t ? "0." + o : l.toFixed(t)).split("."),
          s = u;
        return (
          u &&
            Number(c[0]) &&
            (s = u
              .split("")
              .reverse()
              .reduce(function (e, t, r) {
                return e.length > r
                  ? (Number(e[0]) + Number(t)).toString() + e.substring(1, e.length)
                  : t + e;
              }, c[0])),
          (i ? "-" : "") + s + (n ? "." : "") + v(c[1] || "", t, r)
        );
      }
      function p(e, t) {
        if (((e.value = e.value), null !== e)) {
          if (e.createTextRange) {
            var r = e.createTextRange();
            return (r.move("character", t), r.select(), !0);
          }
          return e.selectionStart || 0 === e.selectionStart
            ? (e.focus(), e.setSelectionRange(t, t), !0)
            : (e.focus(), !1);
        }
      }
      !(function (e) {
        ((e.event = "event"), (e.props = "prop"));
      })(n || (n = {}));
      var h = (function (e) {
          var t,
            r = void 0;
          return function () {
            for (var n = [], a = arguments.length; a--; ) n[a] = arguments[a];
            return t &&
              n.length === t.length &&
              n.every(function (e, r) {
                return e === t[r];
              })
              ? r
              : ((t = n), (r = e.apply(void 0, n)));
          };
        })(function (e, t) {
          for (var r = 0, n = 0, a = e.length, u = t.length; e[r] === t[r] && r < a; ) r++;
          for (; e[a - 1 - n] === t[u - 1 - n] && u - n > r && a - n > r; ) n++;
          return { from: { start: r, end: a - n }, to: { start: r, end: u - n } };
        }),
        S = function (e, t) {
          var r = Math.min(e.selectionStart, t);
          return { from: { start: r, end: e.selectionEnd }, to: { start: r, end: t } };
        };
      function b(e) {
        return Math.max(e.selectionStart, e.selectionEnd);
      }
      function y(e) {
        return { from: { start: 0, end: 0 }, to: { start: 0, end: e.length }, lastValue: "" };
      }
      function V(e, t) {
        return (void 0 === e && (e = " "), "string" == typeof e) ? e : e[t] || " ";
      }
      function w(e) {
        var t = e.currentValue,
          r = e.formattedValue,
          n = e.currentValueIndex,
          a = e.formattedValueIndex;
        return t[n] === r[a];
      }
      function x(e, t, r, n) {
        var a = e.length;
        if (((t = Math.min(Math.max(t, 0), a)), "left" === n)) {
          for (; t >= 0 && !r[t]; ) t--;
          -1 === t && (t = r.indexOf(!0));
        } else {
          for (; t <= a && !r[t]; ) t++;
          t > a && (t = r.lastIndexOf(!0));
        }
        return (-1 === t && (t = a), t);
      }
      function D(e) {
        for (
          var t = Array.from({ length: e.length + 1 }).map(function () {
              return !0;
            }),
            r = 0,
            n = t.length;
          r < n;
          r++
        )
          t[r] = !!(i(e[r]) || i(e[r - 1]));
        return t;
      }
      function N(e, t, r, n, u, i) {
        void 0 === i && (i = o);
        var s,
          f,
          v =
            ((s = function (e, t) {
              var r, a;
              return (
                c(e)
                  ? ((a = ""), (r = ""))
                  : (r =
                      "number" == typeof e || t
                        ? n((a = "number" == typeof e ? g(e) : e))
                        : n((a = u(e, void 0)))),
                { formattedValue: r, numAsString: a }
              );
            }),
            ((f = (0, a.useRef)(s)).current = s),
            (0, a.useRef)(function () {
              for (var e = [], t = arguments.length; t--; ) e[t] = arguments[t];
              return f.current.apply(f, e);
            }).current),
          d = (0, a.useState)(function () {
            return v(l(e) ? t : e, r);
          }),
          m = d[0],
          p = d[1],
          h = e,
          S = r;
        l(e) && ((h = m.numAsString), (S = !0));
        var b = v(h, S);
        return (
          (0, a.useMemo)(
            function () {
              p(b);
            },
            [b.formattedValue]
          ),
          [
            m,
            function (e, t) {
              (e.formattedValue !== m.formattedValue &&
                p({ formattedValue: e.formattedValue, numAsString: e.value }),
                i(e, t));
            },
          ]
        );
      }
      function O(e) {
        return e.replace(/[^0-9]/g, "");
      }
      function E(e) {
        return e;
      }
      function C(e) {
        var t = e.type;
        void 0 === t && (t = "text");
        var r = e.displayType;
        void 0 === r && (r = "input");
        var l = e.customInput,
          c = e.renderText,
          s = e.getInputRef,
          f = e.format;
        void 0 === f && (f = E);
        var v = e.removeFormatting;
        void 0 === v && (v = O);
        var d = e.defaultValue,
          g = e.valueIsNumericString,
          m = e.onValueChange,
          y = e.isAllowed,
          V = e.onChange;
        void 0 === V && (V = o);
        var C = e.onKeyDown;
        void 0 === C && (C = o);
        var j = e.onMouseUp;
        void 0 === j && (j = o);
        var A = e.onFocus;
        void 0 === A && (A = o);
        var I = e.onBlur;
        void 0 === I && (I = o);
        var k = e.value,
          T = e.getCaretBoundary;
        void 0 === T && (T = D);
        var B = e.isValidInputCharacter;
        void 0 === B && (B = i);
        var F = e.isCharacterSame,
          R = u(e, [
            "type",
            "displayType",
            "customInput",
            "renderText",
            "getInputRef",
            "format",
            "removeFormatting",
            "defaultValue",
            "valueIsNumericString",
            "onValueChange",
            "isAllowed",
            "onChange",
            "onKeyDown",
            "onMouseUp",
            "onFocus",
            "onBlur",
            "value",
            "getCaretBoundary",
            "isValidInputCharacter",
            "isCharacterSame",
          ]),
          M = N(k, d, !!g, f, v, m),
          K = M[0],
          W = K.formattedValue,
          L = K.numAsString,
          P = M[1],
          G = (0, a.useRef)(),
          $ = (0, a.useRef)({ formattedValue: W, numAsString: L }),
          _ = function (e, t) {
            (($.current = { formattedValue: e.formattedValue, numAsString: e.value }), P(e, t));
          },
          U = (0, a.useState)(!1),
          Z = U[0],
          q = U[1],
          H = (0, a.useRef)(null),
          z = (0, a.useRef)({ setCaretTimeout: null, focusTimeout: null });
        (0, a.useEffect)(function () {
          return (
            q(!0),
            function () {
              (clearTimeout(z.current.setCaretTimeout), clearTimeout(z.current.focusTimeout));
            }
          );
        }, []);
        var J = f,
          Q = function (e, t) {
            var r = parseFloat(t);
            return { formattedValue: e, value: t, floatValue: isNaN(r) ? void 0 : r };
          },
          X = function (e, t, r) {
            (0 !== e.selectionStart || e.selectionEnd !== e.value.length) &&
              (p(e, t),
              (z.current.setCaretTimeout = setTimeout(function () {
                e.value === r && e.selectionStart !== t && p(e, t);
              }, 0)));
          },
          Y = function (e, t, r) {
            return x(e, t, T(e), r);
          },
          ee = function (e, t, r) {
            var n = T(t),
              a = (function (e, t, r, n, a, u, o) {
                void 0 === o && (o = w);
                var i = a.findIndex(function (e) {
                    return e;
                  }),
                  l = e.slice(0, i);
                t || r.startsWith(l) || ((t = l), (r = l + r), (n += l.length));
                for (var c = r.length, s = e.length, f = {}, v = Array(c), d = 0; d < c; d++) {
                  v[d] = -1;
                  for (var g = 0; g < s; g++)
                    if (
                      o({
                        currentValue: r,
                        lastValue: t,
                        formattedValue: e,
                        currentValueIndex: d,
                        formattedValueIndex: g,
                      }) &&
                      !0 !== f[g]
                    ) {
                      ((v[d] = g), (f[g] = !0));
                      break;
                    }
                }
                for (var m = n; m < c && (-1 === v[m] || !u(r[m])); ) m++;
                var p = m === c || -1 === v[m] ? s : v[m];
                for (m = n - 1; m > 0 && -1 === v[m]; ) m--;
                var h = -1 === m || -1 === v[m] ? 0 : v[m] + 1;
                return h > p ? p : n - h < p - n ? h : p;
              })(t, W, e, r, n, B, F);
            return x(t, a, n);
          },
          et = function (e) {
            var t,
              r = e.formattedValue;
            void 0 === r && (r = "");
            var n = e.input,
              a = e.source,
              u = e.event,
              o = e.numAsString;
            if (n) {
              var i = e.inputValue || n.value,
                l = b(n);
              ((n.value = r), void 0 !== (t = ee(i, r, l)) && X(n, t, r));
            }
            r !== W && _(Q(r, o), { event: u, source: a });
          };
        (0, a.useEffect)(
          function () {
            var e = $.current,
              t = e.formattedValue,
              r = e.numAsString;
            (W !== t || L !== r) && _(Q(W, L), { event: void 0, source: n.props });
          },
          [W, L]
        );
        var er = H.current ? b(H.current) : void 0;
        ("undefined" != typeof window ? a.useLayoutEffect : a.useEffect)(
          function () {
            var e = H.current;
            if (W !== $.current.formattedValue && e) {
              var t = ee($.current.formattedValue, W, er);
              ((e.value = W), X(e, t, W));
            }
          },
          [W]
        );
        var en = function (e, t, r) {
            var n = t.target,
              a = Object.assign(
                Object.assign({}, G.current ? S(G.current, n.selectionEnd) : h(W, e)),
                { lastValue: W }
              ),
              u = v(e, a),
              o = J(u);
            if (((u = v(o, void 0)), y && !y(Q(o, u)))) {
              var i = t.target,
                l = ee(e, W, b(i));
              return ((i.value = W), X(i, l, W), !1);
            }
            return (
              et({
                formattedValue: o,
                numAsString: u,
                inputValue: e,
                event: t,
                source: r,
                input: t.target,
              }),
              !0
            );
          },
          ea = function (e, t) {
            (void 0 === t && (t = 0),
              (G.current = { selectionStart: e.selectionStart, selectionEnd: e.selectionEnd + t }));
          },
          eu = Object.assign(
            {
              inputMode:
                Z &&
                "undefined" != typeof navigator &&
                !(navigator.platform && /iPhone|iPod/.test(navigator.platform))
                  ? "numeric"
                  : void 0,
            },
            R,
            {
              type: t,
              value: W,
              onChange: function (e) {
                (en(e.target.value, e, n.event) && V(e), (G.current = void 0));
              },
              onKeyDown: function (e) {
                var t,
                  r = e.target,
                  n = e.key,
                  a = r.selectionStart,
                  u = r.selectionEnd,
                  o = r.value;
                (void 0 === o && (o = ""),
                  "ArrowLeft" === n || "Backspace" === n
                    ? (t = Math.max(a - 1, 0))
                    : "ArrowRight" === n
                      ? (t = Math.min(a + 1, o.length))
                      : "Delete" === n && (t = a));
                var i = 0;
                "Delete" === n && a === u && (i = 1);
                var l = "ArrowLeft" === n || "ArrowRight" === n;
                if (void 0 === t || (a !== u && !l)) {
                  (C(e), ea(r, i));
                  return;
                }
                var c = t;
                (l
                  ? (c = Y(o, t, "ArrowLeft" === n ? "left" : "right")) !== t && e.preventDefault()
                  : "Delete" !== n || B(o[t])
                    ? "Backspace" !== n || B(o[t]) || (c = Y(o, t, "left"))
                    : (c = Y(o, t, "right")),
                  c !== t && X(r, c, o),
                  C(e),
                  ea(r, i));
              },
              onMouseUp: function (e) {
                var t = e.target,
                  r = function () {
                    var e = t.selectionStart,
                      r = t.selectionEnd,
                      n = t.value;
                    if ((void 0 === n && (n = ""), e === r)) {
                      var a = Y(n, e);
                      a !== e && X(t, a, n);
                    }
                  };
                (r(),
                  requestAnimationFrame(function () {
                    r();
                  }),
                  j(e),
                  ea(t));
              },
              onFocus: function (e) {
                e.persist && e.persist();
                var t = e.target,
                  r = e.currentTarget;
                ((H.current = t),
                  (z.current.focusTimeout = setTimeout(function () {
                    var n = t.selectionStart,
                      a = t.selectionEnd,
                      u = t.value;
                    void 0 === u && (u = "");
                    var o = Y(u, n);
                    (o !== n && (0 !== n || a !== u.length) && X(t, o, u),
                      A(Object.assign(Object.assign({}, e), { currentTarget: r })));
                  }, 0)));
              },
              onBlur: function (e) {
                ((H.current = null),
                  clearTimeout(z.current.focusTimeout),
                  clearTimeout(z.current.setCaretTimeout),
                  I(e));
              },
            }
          );
        return "text" === r
          ? c
            ? a.createElement(a.Fragment, null, c(W, R) || null)
            : a.createElement("span", Object.assign({}, R, { ref: s }), W)
          : l
            ? a.createElement(l, Object.assign({}, eu, { ref: s }))
            : a.createElement("input", Object.assign({}, eu, { ref: s }));
      }
      function j(e, t) {
        var r,
          n,
          a,
          u = t.decimalScale,
          o = t.fixedDecimalScale,
          i = t.prefix;
        void 0 === i && (i = "");
        var l = t.suffix;
        void 0 === l && (l = "");
        var c = t.allowNegative,
          s = t.thousandsGroupStyle;
        if ((void 0 === s && (s = "thousand"), "" === e || "-" === e)) return e;
        var d = A(t),
          g = d.thousandSeparator,
          m = d.decimalSeparator,
          p = (0 !== u && -1 !== e.indexOf(".")) || (u && o),
          h = f(e, c),
          S = h.beforeDecimal,
          b = h.afterDecimal,
          y = h.addNegation;
        return (
          void 0 !== u && (b = v(b, u, !!o)),
          g &&
            ((r = S),
            (n = (function (e) {
              switch (e) {
                case "lakh":
                  return /(\d+?)(?=(\d\d)+(\d)(?!\d))(\.\d+)?/g;
                case "wan":
                  return /(\d)(?=(\d{4})+(?!\d))/g;
                default:
                  return /(\d)(?=(\d{3})+(?!\d))/g;
              }
            })(s)),
            (a = -1 === (a = r.search(/[1-9]/)) ? r.length : a),
            (S = r.substring(0, a) + r.substring(a, r.length).replace(n, "$1" + g))),
          i && (S = i + S),
          l && (b += l),
          y && (S = "-" + S),
          (e = S + ((p && m) || "") + b)
        );
      }
      function A(e) {
        var t = e.decimalSeparator;
        void 0 === t && (t = ".");
        var r = e.thousandSeparator,
          n = e.allowedDecimalSeparators;
        return (
          !0 === r && (r = ","),
          n || (n = [t, "."]),
          { decimalSeparator: t, thousandSeparator: r, allowedDecimalSeparators: n }
        );
      }
      function I(e) {
        var t,
          r,
          v,
          d,
          S,
          b,
          V,
          w,
          x,
          D,
          O,
          E,
          I,
          k,
          T,
          B,
          F,
          R,
          M,
          K,
          W,
          L,
          P,
          G,
          $,
          _,
          U,
          Z,
          q,
          H =
            ((t = (function (e) {
              var t = A(e),
                r = t.thousandSeparator,
                n = t.decimalSeparator,
                a = e.prefix;
              void 0 === a && (a = "");
              var u = e.allowNegative;
              if ((void 0 === u && (u = !0), r === n))
                throw Error(
                  "\n        Decimal separator can't be same as thousand separator.\n        thousandSeparator: " +
                    r +
                    ' (thousandSeparator = {true} is same as thousandSeparator = ",")\n        decimalSeparator: ' +
                    n +
                    " (default value for decimalSeparator is .)\n     "
                );
              return (
                a.startsWith("-") &&
                  u &&
                  (console.error(
                    "\n      Prefix can't start with '-' when allowNegative is true.\n      prefix: " +
                      a +
                      "\n      allowNegative: " +
                      u +
                      "\n    "
                  ),
                  (u = !1)),
                Object.assign(Object.assign({}, e), { allowNegative: u })
              );
            })((t = e))).decimalSeparator,
            t.allowedDecimalSeparators,
            t.thousandsGroupStyle,
            (r = t.suffix),
            (v = t.allowNegative),
            (d = t.allowLeadingZeros),
            void 0 === (S = t.onKeyDown) && (S = o),
            void 0 === (b = t.onBlur) && (b = o),
            (V = t.thousandSeparator),
            (w = t.decimalScale),
            (x = t.fixedDecimalScale),
            void 0 === (D = t.prefix) && (D = ""),
            (O = t.defaultValue),
            (E = t.value),
            (I = t.valueIsNumericString),
            (k = t.onValueChange),
            (T = u(t, [
              "decimalSeparator",
              "allowedDecimalSeparators",
              "thousandsGroupStyle",
              "suffix",
              "allowNegative",
              "allowLeadingZeros",
              "onKeyDown",
              "onBlur",
              "thousandSeparator",
              "decimalScale",
              "fixedDecimalScale",
              "prefix",
              "defaultValue",
              "value",
              "valueIsNumericString",
              "onValueChange",
            ])),
            (F = (B = A(t)).decimalSeparator),
            (R = B.allowedDecimalSeparators),
            (M = function (e) {
              return j(e, t);
            }),
            (K = function (e, r) {
              return (function (e, t, r) {
                void 0 === t && (t = y(e));
                var n,
                  a,
                  u,
                  o,
                  l = r.allowNegative,
                  c = r.prefix;
                void 0 === c && (c = "");
                var v = r.suffix;
                void 0 === v && (v = "");
                var d = r.decimalScale,
                  g = t.from,
                  m = t.to,
                  p = m.start,
                  h = m.end,
                  S = A(r),
                  b = S.allowedDecimalSeparators,
                  V = S.decimalSeparator,
                  w = e[h] === V;
                if (i(e) && (e === c || e === v) && "" === t.lastValue) return e;
                if (h - p == 1 && -1 !== b.indexOf(e[p])) {
                  var x = 0 === d ? "" : V;
                  e = e.substring(0, p) + x + e.substring(p + 1, e.length);
                }
                var D = function (e, t, r) {
                    var n = !1,
                      a = !1;
                    c.startsWith("-")
                      ? (n = !1)
                      : e.startsWith("--")
                        ? ((n = !1), (a = !0))
                        : v.startsWith("-") && e.length === v.length
                          ? (n = !1)
                          : "-" === e[0] && (n = !0);
                    var u = +!!n;
                    return (
                      a && (u = 2),
                      u && ((e = e.substring(u)), (t -= u), (r -= u)),
                      { value: e, start: t, end: r, hasNegation: n }
                    );
                  },
                  N = D(e, p, h),
                  O = N.hasNegation;
                ((e = N.value), (p = N.start), (h = N.end));
                var E = D(t.lastValue, g.start, g.end),
                  C = E.start,
                  j = E.end,
                  I = E.value,
                  k = e.substring(p, h);
                e.length &&
                  I.length &&
                  (C > I.length - v.length || j < c.length) &&
                  !(k && v.startsWith(k)) &&
                  (e = I);
                var T = 0;
                (e.startsWith(c) ? (T += c.length) : p < c.length && (T = p),
                  (e = e.substring(T)),
                  (h -= T));
                var B = e.length,
                  F = e.length - v.length;
                (e.endsWith(v) ? (B = F) : h > F ? (B = h) : h > e.length - v.length && (B = h),
                  (e = e.substring(0, B)),
                  void 0 === (n = O ? "-" + e : e) && (n = ""),
                  (a = RegExp("(-)(.)*(-)")),
                  (u = /(-)/.test(n)),
                  (o = a.test(n)),
                  (n = n.replace(/-/g, "")),
                  u && !o && l && (n = "-" + n));
                var R = (e = ((e = n).match(RegExp("(^-)|[0-9]|" + s(V), "g")) || []).join(
                    ""
                  )).indexOf(V),
                  M = f(
                    (e = e.replace(RegExp(s(V), "g"), function (e, t) {
                      return t === R ? "." : "";
                    })),
                    l
                  ),
                  K = M.beforeDecimal,
                  W = M.afterDecimal,
                  L = M.addNegation;
                return (
                  m.end - m.start < g.end - g.start &&
                    "" === K &&
                    w &&
                    !parseFloat(W) &&
                    (e = L ? "-" : ""),
                  e
                );
              })(e, r, t);
            }),
            (W = l(E) ? O : E),
            (P =
              null != I
                ? I
                : ((L = D),
                  "" === W ||
                    (!(null == L ? void 0 : L.match(/\d/)) &&
                      !(null == r ? void 0 : r.match(/\d/)) &&
                      "string" == typeof W &&
                      !isNaN(Number(W))))),
            l(E) ? l(O) || (P = P || "number" == typeof O) : (P = P || "number" == typeof E),
            (U = (_ = ($ = N(
              (G = function (e) {
                return c(e)
                  ? e
                  : ("number" == typeof e && (e = g(e)), P && "number" == typeof w)
                    ? m(e, w, !!x)
                    : e;
              })(E),
              G(O),
              !!P,
              M,
              K,
              k
            ))[0]).numAsString),
            (Z = _.formattedValue),
            (q = $[1]),
            Object.assign(Object.assign({}, T), {
              value: Z,
              valueIsNumericString: !1,
              isValidInputCharacter: function (e) {
                return e === F || i(e);
              },
              isCharacterSame: function (e) {
                var t = e.currentValue,
                  r = e.lastValue,
                  n = e.formattedValue,
                  a = e.currentValueIndex,
                  u = e.formattedValueIndex,
                  o = t[a],
                  i = n[u],
                  l = h(r, t).to,
                  c = function (e) {
                    return K(e).indexOf(".") + D.length;
                  };
                return (
                  !(0 === E && x && w && t[l.start] === F && c(t) < a && c(n) > u) &&
                  ((!!(a >= l.start && a < l.end && R && R.includes(o)) && i === F) || o === i)
                );
              },
              onValueChange: q,
              format: M,
              removeFormatting: K,
              getCaretBoundary: function (e) {
                var r, n, a, u, o, i;
                return (
                  void 0 === (n = (r = t).prefix) && (n = ""),
                  void 0 === (a = r.suffix) && (a = ""),
                  (u = Array.from({ length: e.length + 1 }).map(function () {
                    return !0;
                  })),
                  (o = "-" === e[0]),
                  u.fill(!1, 0, n.length + +!!o),
                  (i = e.length),
                  u.fill(!1, i - a.length + 1, i + 1),
                  u
                );
              },
              onKeyDown: function (e) {
                var t = e.target,
                  r = e.key,
                  n = t.selectionStart,
                  a = t.selectionEnd,
                  u = t.value;
                if (
                  (void 0 === u && (u = ""), ("Backspace" === r || "Delete" === r) && a < D.length)
                )
                  return void e.preventDefault();
                if (n !== a) return void S(e);
                ("Backspace" === r && "-" === u[0] && n === D.length + 1 && v && p(t, 1),
                  w &&
                    x &&
                    ("Backspace" === r && u[n - 1] === F
                      ? (p(t, n - 1), e.preventDefault())
                      : "Delete" === r && u[n] === F && e.preventDefault()),
                  (null == R ? void 0 : R.includes(r)) && u[n] === F && p(t, n + 1));
                var o = !0 === V ? "," : V;
                ("Backspace" === r && u[n - 1] === o && p(t, n - 1),
                  "Delete" === r && u[n] === o && p(t, n + 1),
                  S(e));
              },
              onBlur: function (e) {
                var r = U;
                (r.match(/\d/g) || (r = ""),
                  d ||
                    (r = (function (e) {
                      if (!e) return e;
                      var t = "-" === e[0];
                      t && (e = e.substring(1, e.length));
                      var r = e.split("."),
                        n = r[0].replace(/^0+/, "") || "0",
                        a = r[1] || "";
                      return (t ? "-" : "") + n + (a ? "." + a : "");
                    })(r)),
                  x && w && (r = m(r, w, x)),
                  r !== U &&
                    q(
                      { formattedValue: j(r, t), value: r, floatValue: parseFloat(r) },
                      { event: e, source: n.event }
                    ),
                  b(e));
              },
            }));
        return a.createElement(C, Object.assign({}, H));
      }
      function k(e) {
        var t = (function (e) {
          (e.mask, e.allowEmptyFormatting);
          var t = e.format,
            r = e.inputMode;
          void 0 === r && (r = "numeric");
          var n = e.onKeyDown;
          void 0 === n && (n = o);
          var a = e.patternChar;
          void 0 === a && (a = "#");
          var c = e.value,
            s = e.defaultValue,
            f = e.valueIsNumericString,
            v = u(e, [
              "mask",
              "allowEmptyFormatting",
              "format",
              "inputMode",
              "onKeyDown",
              "patternChar",
              "value",
              "defaultValue",
              "valueIsNumericString",
            ]),
            d = e.mask;
          if (d && ("string" === d ? d : d.toString()).match(/\d/g))
            throw Error("Mask " + d + " should not contain numeric character;");
          var g = function (t) {
              return (function (e, t) {
                var r = t.format,
                  n = t.mask,
                  a = t.patternChar;
                void 0 === a && (a = "#");
                var u = Array.from({ length: e.length + 1 }).map(function () {
                    return !0;
                  }),
                  o = 0,
                  i = -1,
                  l = {};
                r.split("").forEach(function (t, r) {
                  var u = void 0;
                  (t === a && ((u = V(n, ++o - 1)), -1 === i && e[r] === u && (i = r)), (l[r] = u));
                });
                for (
                  var c = function (t) {
                      return r[t] === a && e[t] !== l[t];
                    },
                    s = 0,
                    f = u.length;
                  s < f;
                  s++
                )
                  u[s] = s === i || c(s) || c(s - 1);
                return ((u[r.indexOf(a)] = !0), u);
              })(t, e);
            },
            m = l(c) ? s : c,
            h =
              null != f
                ? f
                : "" === m ||
                  (!(null == t ? void 0 : t.match(/\d/)) &&
                    "string" == typeof m &&
                    (!!m.match(/^\d+$/) || "" === m)),
            S = Object.assign(Object.assign({}, e), { valueIsNumericString: h });
          return Object.assign(Object.assign({}, v), {
            value: c,
            defaultValue: s,
            valueIsNumericString: h,
            inputMode: r,
            format: function (e) {
              return (function (e, t) {
                var r = t.format,
                  n = t.allowEmptyFormatting,
                  a = t.mask,
                  u = t.patternChar;
                if ((void 0 === u && (u = "#"), "" === e && !n)) return "";
                for (var o = 0, i = r.split(""), l = 0, c = r.length; l < c; l++)
                  r[l] === u && ((i[l] = e[o] || V(a, o)), (o += 1));
                return i.join("");
              })(e, S);
            },
            removeFormatting: function (e, t) {
              return (function (e, t, r) {
                void 0 === t && (t = y(e));
                var n = r.format,
                  a = r.patternChar;
                void 0 === a && (a = "#");
                var u = t.from,
                  o = t.to,
                  l = t.lastValue;
                void 0 === l && (l = "");
                var c = function (e) {
                    return n[e] === a;
                  },
                  s = function (e, t) {
                    for (var r = "", n = 0; n < e.length; n++) c(t + n) && i(e[n]) && (r += e[n]);
                    return r;
                  },
                  f = function (e) {
                    return e.replace(/[^0-9]/g, "");
                  };
                if (!n.match(/\d/)) return f(e);
                if (("" === l || u.end - u.start === l.length) && e.length === n.length) {
                  for (var v = "", d = 0; d < e.length; d++)
                    if (c(d)) i(e[d]) && (v += e[d]);
                    else if (e[d] !== n[d]) return f(e);
                  return v;
                }
                var g = l.substring(0, u.start),
                  m = e.substring(o.start, o.end),
                  p = l.substring(u.end);
                return "" + s(g, 0) + f(m) + s(p, u.end);
              })(e, t, S);
            },
            getCaretBoundary: g,
            onKeyDown: function (e) {
              var r = e.key,
                u = e.target,
                o = u.selectionStart,
                i = u.selectionEnd,
                l = u.value;
              if (o !== i) return void n(e);
              var c = o;
              if ("Backspace" === r || "Delete" === r) {
                var s = "right";
                if ("Backspace" === r) {
                  for (; c > 0 && t[c - 1] !== a; ) c--;
                  s = "left";
                } else {
                  for (var f = t.length; c < f && t[c] !== a; ) c++;
                  s = "right";
                }
                c = x(l, c, g(l), s);
              } else
                t[c] !== a &&
                  "ArrowLeft" !== r &&
                  "ArrowRight" !== r &&
                  (c = x(l, c + 1, g(l), "right"));
              (c !== o && p(u, c), n(e));
            },
          });
        })(e);
        return a.createElement(C, Object.assign({}, t));
      }
    },
  },
]);
