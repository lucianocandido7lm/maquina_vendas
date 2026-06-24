"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [2573],
  {
    12539: (e, t, r) => {
      r.d(t, { E: () => P });
      var n,
        o,
        i,
        s,
        a,
        l,
        u,
        d,
        c = function () {
          return "undefined" != typeof window;
        },
        f = function () {
          return n || (c() && (n = window.gsap) && n.registerPlugin && n);
        },
        g = /[-+=\.]*\d+[\.e\-\+]*\d*[e\-\+]*\d*/gi,
        p = {
          rect: ["width", "height"],
          circle: ["r", "r"],
          ellipse: ["rx", "ry"],
          line: ["x2", "y2"],
        },
        h = function (e) {
          return Math.round(1e4 * e) / 1e4;
        },
        y = function (e) {
          return parseFloat(e) || 0;
        },
        m = function (e, t) {
          var r = y(e);
          return ~e.indexOf("%") ? (r / 100) * t : r;
        },
        v = function (e, t) {
          return y(e.getAttribute(t));
        },
        _ = Math.sqrt,
        D = function (e, t, r, n, o, i) {
          return _(Math.pow((y(r) - y(e)) * o, 2) + Math.pow((y(n) - y(t)) * i, 2));
        },
        x = function (e) {
          return console.warn(e);
        },
        w = function (e) {
          return "non-scaling-stroke" === e.getAttribute("vector-effect");
        },
        b = function (e, t, r) {
          var n,
            o,
            i = e.indexOf(" ");
          return (
            i < 0
              ? ((n = void 0 !== r ? r + "" : e), (o = e))
              : ((n = e.substr(0, i)), (o = e.substr(i + 1))),
            (n = m(n, t)) > (o = m(o, t)) ? [o, n] : [n, o]
          );
        },
        C = function (e) {
          if (!(e = o(e)[0])) return 0;
          var t,
            r,
            n,
            i,
            s,
            a,
            u,
            d = e.tagName.toLowerCase(),
            c = e.style,
            f = 1,
            y = 1;
          w(e) &&
            ((f = _((y = e.getScreenCTM()).a * y.a + y.b * y.b)), (y = _(y.d * y.d + y.c * y.c)));
          try {
            r = e.getBBox();
          } catch (e) {
            x(
              "Some browsers won't measure invisible elements (like display:none or masks inside defs)."
            );
          }
          var m = r || { x: 0, y: 0, width: 0, height: 0 },
            b = m.x,
            C = m.y,
            k = m.width,
            O = m.height;
          if (
            ((r && (k || O)) ||
              !p[d] ||
              ((k = v(e, p[d][0])),
              (O = v(e, p[d][1])),
              "rect" !== d && "line" !== d && ((k *= 2), (O *= 2)),
              "line" === d &&
                ((b = v(e, "x1")), (C = v(e, "y1")), (k = Math.abs(k - b)), (O = Math.abs(O - C)))),
            "path" === d)
          )
            ((i = c.strokeDasharray),
              (c.strokeDasharray = "none"),
              (t = e.getTotalLength() || 0),
              h(f) !== h(y) &&
                !l &&
                (l = 1) &&
                x(
                  "Warning: <path> length cannot be measured when vector-effect is non-scaling-stroke and the element isn't proportionally scaled."
                ),
              (t *= (f + y) / 2),
              (c.strokeDasharray = i));
          else if ("rect" === d) t = 2 * k * f + 2 * O * y;
          else if ("line" === d) t = D(b, C, b + k, C + O, f, y);
          else if ("polyline" === d || "polygon" === d)
            for (
              n = e.getAttribute("points").match(g) || [],
                "polygon" === d && n.push(n[0], n[1]),
                t = 0,
                s = 2;
              s < n.length;
              s += 2
            )
              t += D(n[s - 2], n[s - 1], n[s], n[s + 1], f, y) || 0;
          else
            ("circle" === d || "ellipse" === d) &&
              (t =
                Math.PI *
                (3 * ((a = (k / 2) * f) + (u = (O / 2) * y)) - _((3 * a + u) * (a + 3 * u))));
          return t || 0;
        },
        k = function (e, t) {
          if (!(e = o(e)[0])) return [0, 0];
          t || (t = C(e) + 1);
          var r = i.getComputedStyle(e),
            n = r.strokeDasharray || "",
            s = y(r.strokeDashoffset),
            a = n.indexOf(",");
          return (
            a < 0 && (a = n.indexOf(" ")),
            (n = a < 0 ? t : y(n.substr(0, a))) > t && (n = t),
            [-s || 0, n - s || 0]
          );
        },
        O = function () {
          c() &&
            (document,
            (i = window),
            (a = n = f()),
            (o = n.utils.toArray),
            (u = n.core.getStyleSaver),
            (d = n.core.reverting || function () {}),
            (s = -1 !== ((i.navigator || {}).userAgent || "").indexOf("Edge")));
        },
        P = {
          version: "3.13.0",
          name: "drawSVG",
          register: function (e) {
            ((n = e), O());
          },
          init: function (e, t, r, n, o) {
            if (!e.getBBox) return !1;
            a || O();
            var l,
              d,
              c,
              f = C(e);
            return (
              (this.styles = u && u(e, "strokeDashoffset,strokeDasharray,strokeMiterlimit")),
              (this.tween = r),
              (this._style = e.style),
              (this._target = e),
              t + "" == "true"
                ? (t = "0 100%")
                : t
                  ? -1 === (t + "").indexOf(" ") && (t = "0 " + t)
                  : (t = "0 0"),
              (l = k(e, f)),
              (d = b(t, f, l[0])),
              (this._length = h(f)),
              (this._dash = h(l[1] - l[0])),
              (this._offset = h(-l[0])),
              (this._dashPT = this.add(
                this,
                "_dash",
                this._dash,
                h(d[1] - d[0]),
                0,
                0,
                0,
                0,
                0,
                1
              )),
              (this._offsetPT = this.add(
                this,
                "_offset",
                this._offset,
                h(-d[0]),
                0,
                0,
                0,
                0,
                0,
                1
              )),
              s &&
                (c = i.getComputedStyle(e)).strokeLinecap !== c.strokeLinejoin &&
                ((d = y(c.strokeMiterlimit)), this.add(e.style, "strokeMiterlimit", d, d + 0.01)),
              (this._live = w(e) || ~(t + "").indexOf("live")),
              (this._nowrap = ~(t + "").indexOf("nowrap")),
              this._props.push("drawSVG"),
              1
            );
          },
          render: function (e, t) {
            if (t.tween._time || !d()) {
              var r,
                n,
                o,
                i,
                s = t._pt,
                a = t._style;
              if (s) {
                for (
                  t._live &&
                  (r = C(t._target)) !== t._length &&
                  ((n = r / t._length),
                  (t._length = r),
                  t._offsetPT && ((t._offsetPT.s *= n), (t._offsetPT.c *= n)),
                  t._dashPT ? ((t._dashPT.s *= n), (t._dashPT.c *= n)) : (t._dash *= n));
                  s;

                )
                  (s.r(e, s.d), (s = s._next));
                ((o = t._dash || (e && 1 !== e && 1e-4) || 0),
                  (r = t._length - o + 0.1),
                  (i = t._offset),
                  o &&
                    i &&
                    o + Math.abs(i % t._length) > t._length - 0.05 &&
                    (i += i < 0 ? 0.005 : -0.005) &&
                    (r += 0.005),
                  (a.strokeDashoffset = o ? i : i + 0.001),
                  (a.strokeDasharray =
                    r < 0.1
                      ? "none"
                      : o
                        ? o + "px," + (t._nowrap ? 999999 : r) + "px"
                        : "0px, 999999px"));
              }
            } else t.styles.revert();
          },
          getLength: C,
          getPosition: k,
        };
      f() && n.registerPlugin(P);
    },
    89511: (e, t, r) => {
      (r.r(t),
        r.d(t, {
          Close: () => ei,
          Content: () => er,
          Description: () => eo,
          Dialog: () => C,
          DialogClose: () => H,
          DialogContent: () => F,
          DialogDescription: () => $,
          DialogOverlay: () => M,
          DialogPortal: () => T,
          DialogTitle: () => W,
          DialogTrigger: () => O,
          Overlay: () => et,
          Portal: () => ee,
          Root: () => X,
          Title: () => en,
          Trigger: () => Y,
          WarningProvider: () => Z,
          createDialogScope: () => x,
        }));
      var n = r(12115),
        o = r(92556),
        i = r(94446),
        s = r(3468),
        a = r(68946),
        l = r(23558),
        u = r(44831),
        d = r(69666),
        c = r(75433),
        f = r(76842),
        g = r(97602),
        p = r(19526),
        h = r(40101),
        y = r(97745),
        m = r(32467),
        v = r(95155),
        _ = "Dialog",
        [D, x] = (0, s.A)(_),
        [w, b] = D(_),
        C = (e) => {
          let {
              __scopeDialog: t,
              children: r,
              open: o,
              defaultOpen: i,
              onOpenChange: s,
              modal: u = !0,
            } = e,
            d = n.useRef(null),
            c = n.useRef(null),
            [f, g] = (0, l.i)({ prop: o, defaultProp: i ?? !1, onChange: s, caller: _ });
          return (0, v.jsx)(w, {
            scope: t,
            triggerRef: d,
            contentRef: c,
            contentId: (0, a.B)(),
            titleId: (0, a.B)(),
            descriptionId: (0, a.B)(),
            open: f,
            onOpenChange: g,
            onOpenToggle: n.useCallback(() => g((e) => !e), [g]),
            modal: u,
            children: r,
          });
        };
      C.displayName = _;
      var k = "DialogTrigger",
        O = n.forwardRef((e, t) => {
          let { __scopeDialog: r, ...n } = e,
            s = b(k, r),
            a = (0, i.s)(t, s.triggerRef);
          return (0, v.jsx)(g.sG.button, {
            type: "button",
            "aria-haspopup": "dialog",
            "aria-expanded": s.open,
            "aria-controls": s.contentId,
            "data-state": K(s.open),
            ...n,
            ref: a,
            onClick: (0, o.m)(e.onClick, s.onOpenToggle),
          });
        });
      O.displayName = k;
      var P = "DialogPortal",
        [j, R] = D(P, { forceMount: void 0 }),
        T = (e) => {
          let { __scopeDialog: t, forceMount: r, children: o, container: i } = e,
            s = b(P, t);
          return (0, v.jsx)(j, {
            scope: t,
            forceMount: r,
            children: n.Children.map(o, (e) =>
              (0, v.jsx)(f.C, {
                present: r || s.open,
                children: (0, v.jsx)(c.Portal, { asChild: !0, container: i, children: e }),
              })
            ),
          });
        };
      T.displayName = P;
      var I = "DialogOverlay",
        M = n.forwardRef((e, t) => {
          let r = R(I, e.__scopeDialog),
            { forceMount: n = r.forceMount, ...o } = e,
            i = b(I, e.__scopeDialog);
          return i.modal
            ? (0, v.jsx)(f.C, { present: n || i.open, children: (0, v.jsx)(E, { ...o, ref: t }) })
            : null;
        });
      M.displayName = I;
      var N = (0, m.TL)("DialogOverlay.RemoveScroll"),
        E = n.forwardRef((e, t) => {
          let { __scopeDialog: r, ...n } = e,
            o = b(I, r);
          return (0, v.jsx)(h.A, {
            as: N,
            allowPinchZoom: !0,
            shards: [o.contentRef],
            children: (0, v.jsx)(g.sG.div, {
              "data-state": K(o.open),
              ...n,
              ref: t,
              style: { pointerEvents: "auto", ...n.style },
            }),
          });
        }),
        A = "DialogContent",
        F = n.forwardRef((e, t) => {
          let r = R(A, e.__scopeDialog),
            { forceMount: n = r.forceMount, ...o } = e,
            i = b(A, e.__scopeDialog);
          return (0, v.jsx)(f.C, {
            present: n || i.open,
            children: i.modal ? (0, v.jsx)(S, { ...o, ref: t }) : (0, v.jsx)(B, { ...o, ref: t }),
          });
        });
      F.displayName = A;
      var S = n.forwardRef((e, t) => {
          let r = b(A, e.__scopeDialog),
            s = n.useRef(null),
            a = (0, i.s)(t, r.contentRef, s);
          return (
            n.useEffect(() => {
              let e = s.current;
              if (e) return (0, y.Eq)(e);
            }, []),
            (0, v.jsx)(G, {
              ...e,
              ref: a,
              trapFocus: r.open,
              disableOutsidePointerEvents: !0,
              onCloseAutoFocus: (0, o.m)(e.onCloseAutoFocus, (e) => {
                (e.preventDefault(), r.triggerRef.current?.focus());
              }),
              onPointerDownOutside: (0, o.m)(e.onPointerDownOutside, (e) => {
                let t = e.detail.originalEvent,
                  r = 0 === t.button && !0 === t.ctrlKey;
                (2 === t.button || r) && e.preventDefault();
              }),
              onFocusOutside: (0, o.m)(e.onFocusOutside, (e) => e.preventDefault()),
            })
          );
        }),
        B = n.forwardRef((e, t) => {
          let r = b(A, e.__scopeDialog),
            o = n.useRef(!1),
            i = n.useRef(!1);
          return (0, v.jsx)(G, {
            ...e,
            ref: t,
            trapFocus: !1,
            disableOutsidePointerEvents: !1,
            onCloseAutoFocus: (t) => {
              (e.onCloseAutoFocus?.(t),
                t.defaultPrevented ||
                  (o.current || r.triggerRef.current?.focus(), t.preventDefault()),
                (o.current = !1),
                (i.current = !1));
            },
            onInteractOutside: (t) => {
              (e.onInteractOutside?.(t),
                t.defaultPrevented ||
                  ((o.current = !0),
                  "pointerdown" === t.detail.originalEvent.type && (i.current = !0)));
              let n = t.target;
              (r.triggerRef.current?.contains(n) && t.preventDefault(),
                "focusin" === t.detail.originalEvent.type && i.current && t.preventDefault());
            },
          });
        }),
        G = n.forwardRef((e, t) => {
          let { __scopeDialog: r, trapFocus: o, onOpenAutoFocus: s, onCloseAutoFocus: a, ...l } = e,
            c = b(A, r),
            f = n.useRef(null),
            g = (0, i.s)(t, f);
          return (
            (0, p.Oh)(),
            (0, v.jsxs)(v.Fragment, {
              children: [
                (0, v.jsx)(d.n, {
                  asChild: !0,
                  loop: !0,
                  trapped: o,
                  onMountAutoFocus: s,
                  onUnmountAutoFocus: a,
                  children: (0, v.jsx)(u.qW, {
                    role: "dialog",
                    id: c.contentId,
                    "aria-describedby": c.descriptionId,
                    "aria-labelledby": c.titleId,
                    "data-state": K(c.open),
                    ...l,
                    ref: g,
                    onDismiss: () => c.onOpenChange(!1),
                  }),
                }),
                (0, v.jsxs)(v.Fragment, {
                  children: [
                    (0, v.jsx)(J, { titleId: c.titleId }),
                    (0, v.jsx)(Q, { contentRef: f, descriptionId: c.descriptionId }),
                  ],
                }),
              ],
            })
          );
        }),
        L = "DialogTitle",
        W = n.forwardRef((e, t) => {
          let { __scopeDialog: r, ...n } = e,
            o = b(L, r);
          return (0, v.jsx)(g.sG.h2, { id: o.titleId, ...n, ref: t });
        });
      W.displayName = L;
      var q = "DialogDescription",
        $ = n.forwardRef((e, t) => {
          let { __scopeDialog: r, ...n } = e,
            o = b(q, r);
          return (0, v.jsx)(g.sG.p, { id: o.descriptionId, ...n, ref: t });
        });
      $.displayName = q;
      var V = "DialogClose",
        H = n.forwardRef((e, t) => {
          let { __scopeDialog: r, ...n } = e,
            i = b(V, r);
          return (0, v.jsx)(g.sG.button, {
            type: "button",
            ...n,
            ref: t,
            onClick: (0, o.m)(e.onClick, () => i.onOpenChange(!1)),
          });
        });
      function K(e) {
        return e ? "open" : "closed";
      }
      H.displayName = V;
      var U = "DialogTitleWarning",
        [Z, z] = (0, s.q)(U, { contentName: A, titleName: L, docsSlug: "dialog" }),
        J = (e) => {
          let { titleId: t } = e,
            r = z(U),
            o = `\`${r.contentName}\` requires a \`${r.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${r.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${r.docsSlug}`;
          return (
            n.useEffect(() => {
              t && (document.getElementById(t) || console.error(o));
            }, [o, t]),
            null
          );
        },
        Q = (e) => {
          let { contentRef: t, descriptionId: r } = e,
            o = z("DialogDescriptionWarning"),
            i = `Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${o.contentName}}.`;
          return (
            n.useEffect(() => {
              let e = t.current?.getAttribute("aria-describedby");
              r && e && (document.getElementById(r) || console.warn(i));
            }, [i, t, r]),
            null
          );
        },
        X = C,
        Y = O,
        ee = T,
        et = M,
        er = F,
        en = W,
        eo = $,
        ei = H;
    },
  },
]);
