"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [7887],
  {
    34212: (e, t, r) => {
      r.d(t, { q: () => n });
      function n(e, [t, r]) {
        return Math.min(r, Math.max(t, e));
      }
    },
    47887: (e, t, r) => {
      (r.r(t),
        r.d(t, {
          Arrow: () => eq,
          Content: () => eA,
          Group: () => e_,
          Icon: () => eL,
          Item: () => eG,
          ItemIndicator: () => eO,
          ItemText: () => eK,
          Label: () => eV,
          Portal: () => eB,
          Root: () => eE,
          ScrollDownButton: () => eU,
          ScrollUpButton: () => eF,
          Select: () => G,
          SelectArrow: () => eI,
          SelectContent: () => Z,
          SelectGroup: () => es,
          SelectIcon: () => W,
          SelectItem: () => eh,
          SelectItemIndicator: () => eg,
          SelectItemText: () => em,
          SelectLabel: () => eu,
          SelectPortal: () => q,
          SelectScrollDownButton: () => eb,
          SelectScrollUpButton: () => ey,
          SelectSeparator: () => ej,
          SelectTrigger: () => O,
          SelectValue: () => U,
          SelectViewport: () => el,
          Separator: () => eW,
          Trigger: () => eD,
          Value: () => eM,
          Viewport: () => eH,
          createSelectScope: () => L,
        }));
      var n = r(12115),
        l = r(47650),
        o = r(34212),
        a = r(92556),
        i = r(88167),
        s = r(94446),
        c = r(3468),
        u = r(66218),
        d = r(44831),
        p = r(19526),
        f = r(69666),
        h = r(68946),
        v = r(73867),
        m = r(75433),
        w = r(97602),
        g = r(32467),
        x = r(70222),
        y = r(23558),
        S = r(4129),
        b = r(78108),
        C = r(861),
        j = r(97745),
        T = r(40101),
        I = r(95155),
        k = [" ", "Enter", "ArrowUp", "ArrowDown"],
        N = [" ", "Enter"],
        R = "Select",
        [P, E, D] = (0, i.N)(R),
        [M, L] = (0, c.A)(R, [D, v.Bk]),
        B = (0, v.Bk)(),
        [A, H] = M(R),
        [_, V] = M(R),
        G = (e) => {
          let {
              __scopeSelect: t,
              children: r,
              open: l,
              defaultOpen: o,
              onOpenChange: a,
              value: i,
              defaultValue: s,
              onValueChange: c,
              dir: d,
              name: p,
              autoComplete: f,
              disabled: m,
              required: w,
              form: g,
            } = e,
            x = B(t),
            [S, b] = n.useState(null),
            [C, j] = n.useState(null),
            [T, k] = n.useState(!1),
            N = (0, u.jH)(d),
            [E, D] = (0, y.i)({ prop: l, defaultProp: o ?? !1, onChange: a, caller: R }),
            [M, L] = (0, y.i)({ prop: i, defaultProp: s, onChange: c, caller: R }),
            H = n.useRef(null),
            V = !S || g || !!S.closest("form"),
            [G, K] = n.useState(new Set()),
            O = Array.from(G)
              .map((e) => e.props.value)
              .join(";");
          return (0, I.jsx)(v.bL, {
            ...x,
            children: (0, I.jsxs)(A, {
              required: w,
              scope: t,
              trigger: S,
              onTriggerChange: b,
              valueNode: C,
              onValueNodeChange: j,
              valueNodeHasChildren: T,
              onValueNodeHasChildrenChange: k,
              contentId: (0, h.B)(),
              value: M,
              onValueChange: L,
              open: E,
              onOpenChange: D,
              dir: N,
              triggerPointerDownPosRef: H,
              disabled: m,
              children: [
                (0, I.jsx)(P.Provider, {
                  scope: t,
                  children: (0, I.jsx)(_, {
                    scope: e.__scopeSelect,
                    onNativeOptionAdd: n.useCallback((e) => {
                      K((t) => new Set(t).add(e));
                    }, []),
                    onNativeOptionRemove: n.useCallback((e) => {
                      K((t) => {
                        let r = new Set(t);
                        return (r.delete(e), r);
                      });
                    }, []),
                    children: r,
                  }),
                }),
                V
                  ? (0, I.jsxs)(
                      ek,
                      {
                        "aria-hidden": !0,
                        required: w,
                        tabIndex: -1,
                        name: p,
                        autoComplete: f,
                        value: M,
                        onChange: (e) => L(e.target.value),
                        disabled: m,
                        form: g,
                        children: [
                          void 0 === M ? (0, I.jsx)("option", { value: "" }) : null,
                          Array.from(G),
                        ],
                      },
                      O
                    )
                  : null,
              ],
            }),
          });
        };
      G.displayName = R;
      var K = "SelectTrigger",
        O = n.forwardRef((e, t) => {
          let { __scopeSelect: r, disabled: l = !1, ...o } = e,
            i = B(r),
            c = H(K, r),
            u = c.disabled || l,
            d = (0, s.s)(t, c.onTriggerChange),
            p = E(r),
            f = n.useRef("touch"),
            [h, m, g] = eR((e) => {
              let t = p().filter((e) => !e.disabled),
                r = t.find((e) => e.value === c.value),
                n = eP(t, e, r);
              void 0 !== n && c.onValueChange(n.value);
            }),
            x = (e) => {
              (u || (c.onOpenChange(!0), g()),
                e &&
                  (c.triggerPointerDownPosRef.current = {
                    x: Math.round(e.pageX),
                    y: Math.round(e.pageY),
                  }));
            };
          return (0, I.jsx)(v.Mz, {
            asChild: !0,
            ...i,
            children: (0, I.jsx)(w.sG.button, {
              type: "button",
              role: "combobox",
              "aria-controls": c.contentId,
              "aria-expanded": c.open,
              "aria-required": c.required,
              "aria-autocomplete": "none",
              dir: c.dir,
              "data-state": c.open ? "open" : "closed",
              disabled: u,
              "data-disabled": u ? "" : void 0,
              "data-placeholder": eN(c.value) ? "" : void 0,
              ...o,
              ref: d,
              onClick: (0, a.m)(o.onClick, (e) => {
                (e.currentTarget.focus(), "mouse" !== f.current && x(e));
              }),
              onPointerDown: (0, a.m)(o.onPointerDown, (e) => {
                f.current = e.pointerType;
                let t = e.target;
                (t.hasPointerCapture(e.pointerId) && t.releasePointerCapture(e.pointerId),
                  0 === e.button &&
                    !1 === e.ctrlKey &&
                    "mouse" === e.pointerType &&
                    (x(e), e.preventDefault()));
              }),
              onKeyDown: (0, a.m)(o.onKeyDown, (e) => {
                let t = "" !== h.current;
                (e.ctrlKey || e.altKey || e.metaKey || 1 !== e.key.length || m(e.key),
                  (!t || " " !== e.key) && k.includes(e.key) && (x(), e.preventDefault()));
              }),
            }),
          });
        });
      O.displayName = K;
      var F = "SelectValue",
        U = n.forwardRef((e, t) => {
          let {
              __scopeSelect: r,
              className: n,
              style: l,
              children: o,
              placeholder: a = "",
              ...i
            } = e,
            c = H(F, r),
            { onValueNodeHasChildrenChange: u } = c,
            d = void 0 !== o,
            p = (0, s.s)(t, c.onValueNodeChange);
          return (
            (0, S.N)(() => {
              u(d);
            }, [u, d]),
            (0, I.jsx)(w.sG.span, {
              ...i,
              ref: p,
              style: { pointerEvents: "none" },
              children: eN(c.value) ? (0, I.jsx)(I.Fragment, { children: a }) : o,
            })
          );
        });
      U.displayName = F;
      var W = n.forwardRef((e, t) => {
        let { __scopeSelect: r, children: n, ...l } = e;
        return (0, I.jsx)(w.sG.span, { "aria-hidden": !0, ...l, ref: t, children: n || "▼" });
      });
      W.displayName = "SelectIcon";
      var q = (e) => (0, I.jsx)(m.Portal, { asChild: !0, ...e });
      q.displayName = "SelectPortal";
      var z = "SelectContent",
        Z = n.forwardRef((e, t) => {
          let r = H(z, e.__scopeSelect),
            [o, a] = n.useState();
          return ((0, S.N)(() => {
            a(new DocumentFragment());
          }, []),
          r.open)
            ? (0, I.jsx)(J, { ...e, ref: t })
            : o
              ? l.createPortal(
                  (0, I.jsx)(X, {
                    scope: e.__scopeSelect,
                    children: (0, I.jsx)(P.Slot, {
                      scope: e.__scopeSelect,
                      children: (0, I.jsx)("div", { children: e.children }),
                    }),
                  }),
                  o
                )
              : null;
        });
      Z.displayName = z;
      var [X, Y] = M(z),
        Q = (0, g.TL)("SelectContent.RemoveScroll"),
        J = n.forwardRef((e, t) => {
          let {
              __scopeSelect: r,
              position: l = "item-aligned",
              onCloseAutoFocus: o,
              onEscapeKeyDown: i,
              onPointerDownOutside: c,
              side: u,
              sideOffset: h,
              align: v,
              alignOffset: m,
              arrowPadding: w,
              collisionBoundary: g,
              collisionPadding: x,
              sticky: y,
              hideWhenDetached: S,
              avoidCollisions: b,
              ...C
            } = e,
            k = H(z, r),
            [N, R] = n.useState(null),
            [P, D] = n.useState(null),
            M = (0, s.s)(t, (e) => R(e)),
            [L, B] = n.useState(null),
            [A, _] = n.useState(null),
            V = E(r),
            [G, K] = n.useState(!1),
            O = n.useRef(!1);
          (n.useEffect(() => {
            if (N) return (0, j.Eq)(N);
          }, [N]),
            (0, p.Oh)());
          let F = n.useCallback(
              (e) => {
                let [t, ...r] = V().map((e) => e.ref.current),
                  [n] = r.slice(-1),
                  l = document.activeElement;
                for (let r of e)
                  if (
                    r === l ||
                    (r?.scrollIntoView({ block: "nearest" }),
                    r === t && P && (P.scrollTop = 0),
                    r === n && P && (P.scrollTop = P.scrollHeight),
                    r?.focus(),
                    document.activeElement !== l)
                  )
                    return;
              },
              [V, P]
            ),
            U = n.useCallback(() => F([L, N]), [F, L, N]);
          n.useEffect(() => {
            G && U();
          }, [G, U]);
          let { onOpenChange: W, triggerPointerDownPosRef: q } = k;
          (n.useEffect(() => {
            if (N) {
              let e = { x: 0, y: 0 },
                t = (t) => {
                  e = {
                    x: Math.abs(Math.round(t.pageX) - (q.current?.x ?? 0)),
                    y: Math.abs(Math.round(t.pageY) - (q.current?.y ?? 0)),
                  };
                },
                r = (r) => {
                  (e.x <= 10 && e.y <= 10 ? r.preventDefault() : N.contains(r.target) || W(!1),
                    document.removeEventListener("pointermove", t),
                    (q.current = null));
                };
              return (
                null !== q.current &&
                  (document.addEventListener("pointermove", t),
                  document.addEventListener("pointerup", r, { capture: !0, once: !0 })),
                () => {
                  (document.removeEventListener("pointermove", t),
                    document.removeEventListener("pointerup", r, { capture: !0 }));
                }
              );
            }
          }, [N, W, q]),
            n.useEffect(() => {
              let e = () => W(!1);
              return (
                window.addEventListener("blur", e),
                window.addEventListener("resize", e),
                () => {
                  (window.removeEventListener("blur", e), window.removeEventListener("resize", e));
                }
              );
            }, [W]));
          let [Z, Y] = eR((e) => {
              let t = V().filter((e) => !e.disabled),
                r = t.find((e) => e.ref.current === document.activeElement),
                n = eP(t, e, r);
              n && setTimeout(() => n.ref.current.focus());
            }),
            J = n.useCallback(
              (e, t, r) => {
                let n = !O.current && !r;
                ((void 0 !== k.value && k.value === t) || n) && (B(e), n && (O.current = !0));
              },
              [k.value]
            ),
            et = n.useCallback(() => N?.focus(), [N]),
            er = n.useCallback(
              (e, t, r) => {
                let n = !O.current && !r;
                ((void 0 !== k.value && k.value === t) || n) && _(e);
              },
              [k.value]
            ),
            en = "popper" === l ? ee : $,
            el =
              en === ee
                ? {
                    side: u,
                    sideOffset: h,
                    align: v,
                    alignOffset: m,
                    arrowPadding: w,
                    collisionBoundary: g,
                    collisionPadding: x,
                    sticky: y,
                    hideWhenDetached: S,
                    avoidCollisions: b,
                  }
                : {};
          return (0, I.jsx)(X, {
            scope: r,
            content: N,
            viewport: P,
            onViewportChange: D,
            itemRefCallback: J,
            selectedItem: L,
            onItemLeave: et,
            itemTextRefCallback: er,
            focusSelectedItem: U,
            selectedItemText: A,
            position: l,
            isPositioned: G,
            searchRef: Z,
            children: (0, I.jsx)(T.A, {
              as: Q,
              allowPinchZoom: !0,
              children: (0, I.jsx)(f.n, {
                asChild: !0,
                trapped: k.open,
                onMountAutoFocus: (e) => {
                  e.preventDefault();
                },
                onUnmountAutoFocus: (0, a.m)(o, (e) => {
                  (k.trigger?.focus({ preventScroll: !0 }), e.preventDefault());
                }),
                children: (0, I.jsx)(d.qW, {
                  asChild: !0,
                  disableOutsidePointerEvents: !0,
                  onEscapeKeyDown: i,
                  onPointerDownOutside: c,
                  onFocusOutside: (e) => e.preventDefault(),
                  onDismiss: () => k.onOpenChange(!1),
                  children: (0, I.jsx)(en, {
                    role: "listbox",
                    id: k.contentId,
                    "data-state": k.open ? "open" : "closed",
                    dir: k.dir,
                    onContextMenu: (e) => e.preventDefault(),
                    ...C,
                    ...el,
                    onPlaced: () => K(!0),
                    ref: M,
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      outline: "none",
                      ...C.style,
                    },
                    onKeyDown: (0, a.m)(C.onKeyDown, (e) => {
                      let t = e.ctrlKey || e.altKey || e.metaKey;
                      if (
                        ("Tab" === e.key && e.preventDefault(),
                        t || 1 !== e.key.length || Y(e.key),
                        ["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key))
                      ) {
                        let t = V()
                          .filter((e) => !e.disabled)
                          .map((e) => e.ref.current);
                        if (
                          (["ArrowUp", "End"].includes(e.key) && (t = t.slice().reverse()),
                          ["ArrowUp", "ArrowDown"].includes(e.key))
                        ) {
                          let r = e.target,
                            n = t.indexOf(r);
                          t = t.slice(n + 1);
                        }
                        (setTimeout(() => F(t)), e.preventDefault());
                      }
                    }),
                  }),
                }),
              }),
            }),
          });
        });
      J.displayName = "SelectContentImpl";
      var $ = n.forwardRef((e, t) => {
        let { __scopeSelect: r, onPlaced: l, ...a } = e,
          i = H(z, r),
          c = Y(z, r),
          [u, d] = n.useState(null),
          [p, f] = n.useState(null),
          h = (0, s.s)(t, (e) => f(e)),
          v = E(r),
          m = n.useRef(!1),
          g = n.useRef(!0),
          { viewport: x, selectedItem: y, selectedItemText: b, focusSelectedItem: C } = c,
          j = n.useCallback(() => {
            if (i.trigger && i.valueNode && u && p && x && y && b) {
              let e = i.trigger.getBoundingClientRect(),
                t = p.getBoundingClientRect(),
                r = i.valueNode.getBoundingClientRect(),
                n = b.getBoundingClientRect();
              if ("rtl" !== i.dir) {
                let l = n.left - t.left,
                  a = r.left - l,
                  i = e.left - a,
                  s = e.width + i,
                  c = Math.max(s, t.width),
                  d = window.innerWidth - 10,
                  p = (0, o.q)(a, [10, Math.max(10, d - c)]);
                ((u.style.minWidth = s + "px"), (u.style.left = p + "px"));
              } else {
                let l = t.right - n.right,
                  a = window.innerWidth - r.right - l,
                  i = window.innerWidth - e.right - a,
                  s = e.width + i,
                  c = Math.max(s, t.width),
                  d = window.innerWidth - 10,
                  p = (0, o.q)(a, [10, Math.max(10, d - c)]);
                ((u.style.minWidth = s + "px"), (u.style.right = p + "px"));
              }
              let a = v(),
                s = window.innerHeight - 20,
                c = x.scrollHeight,
                d = window.getComputedStyle(p),
                f = parseInt(d.borderTopWidth, 10),
                h = parseInt(d.paddingTop, 10),
                w = parseInt(d.borderBottomWidth, 10),
                g = f + h + c + parseInt(d.paddingBottom, 10) + w,
                S = Math.min(5 * y.offsetHeight, g),
                C = window.getComputedStyle(x),
                j = parseInt(C.paddingTop, 10),
                T = parseInt(C.paddingBottom, 10),
                I = e.top + e.height / 2 - 10,
                k = y.offsetHeight / 2,
                N = f + h + (y.offsetTop + k);
              if (N <= I) {
                let e = a.length > 0 && y === a[a.length - 1].ref.current;
                u.style.bottom = "0px";
                let t = Math.max(
                  s - I,
                  k + (e ? T : 0) + (p.clientHeight - x.offsetTop - x.offsetHeight) + w
                );
                u.style.height = N + t + "px";
              } else {
                let e = a.length > 0 && y === a[0].ref.current;
                u.style.top = "0px";
                let t = Math.max(I, f + x.offsetTop + (e ? j : 0) + k);
                ((u.style.height = t + (g - N) + "px"), (x.scrollTop = N - I + x.offsetTop));
              }
              ((u.style.margin = "10px 0"),
                (u.style.minHeight = S + "px"),
                (u.style.maxHeight = s + "px"),
                l?.(),
                requestAnimationFrame(() => (m.current = !0)));
            }
          }, [v, i.trigger, i.valueNode, u, p, x, y, b, i.dir, l]);
        (0, S.N)(() => j(), [j]);
        let [T, k] = n.useState();
        (0, S.N)(() => {
          p && k(window.getComputedStyle(p).zIndex);
        }, [p]);
        let N = n.useCallback(
          (e) => {
            e && !0 === g.current && (j(), C?.(), (g.current = !1));
          },
          [j, C]
        );
        return (0, I.jsx)(et, {
          scope: r,
          contentWrapper: u,
          shouldExpandOnScrollRef: m,
          onScrollButtonChange: N,
          children: (0, I.jsx)("div", {
            ref: d,
            style: { display: "flex", flexDirection: "column", position: "fixed", zIndex: T },
            children: (0, I.jsx)(w.sG.div, {
              ...a,
              ref: h,
              style: { boxSizing: "border-box", maxHeight: "100%", ...a.style },
            }),
          }),
        });
      });
      $.displayName = "SelectItemAlignedPosition";
      var ee = n.forwardRef((e, t) => {
        let { __scopeSelect: r, align: n = "start", collisionPadding: l = 10, ...o } = e,
          a = B(r);
        return (0, I.jsx)(v.UC, {
          ...a,
          ...o,
          ref: t,
          align: n,
          collisionPadding: l,
          style: {
            boxSizing: "border-box",
            ...o.style,
            "--radix-select-content-transform-origin": "var(--radix-popper-transform-origin)",
            "--radix-select-content-available-width": "var(--radix-popper-available-width)",
            "--radix-select-content-available-height": "var(--radix-popper-available-height)",
            "--radix-select-trigger-width": "var(--radix-popper-anchor-width)",
            "--radix-select-trigger-height": "var(--radix-popper-anchor-height)",
          },
        });
      });
      ee.displayName = "SelectPopperPosition";
      var [et, er] = M(z, {}),
        en = "SelectViewport",
        el = n.forwardRef((e, t) => {
          let { __scopeSelect: r, nonce: l, ...o } = e,
            i = Y(en, r),
            c = er(en, r),
            u = (0, s.s)(t, i.onViewportChange),
            d = n.useRef(0);
          return (0, I.jsxs)(I.Fragment, {
            children: [
              (0, I.jsx)("style", {
                dangerouslySetInnerHTML: {
                  __html:
                    "[data-radix-select-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-select-viewport]::-webkit-scrollbar{display:none}",
                },
                nonce: l,
              }),
              (0, I.jsx)(P.Slot, {
                scope: r,
                children: (0, I.jsx)(w.sG.div, {
                  "data-radix-select-viewport": "",
                  role: "presentation",
                  ...o,
                  ref: u,
                  style: { position: "relative", flex: 1, overflow: "hidden auto", ...o.style },
                  onScroll: (0, a.m)(o.onScroll, (e) => {
                    let t = e.currentTarget,
                      { contentWrapper: r, shouldExpandOnScrollRef: n } = c;
                    if (n?.current && r) {
                      let e = Math.abs(d.current - t.scrollTop);
                      if (e > 0) {
                        let n = window.innerHeight - 20,
                          l = Math.max(parseFloat(r.style.minHeight), parseFloat(r.style.height));
                        if (l < n) {
                          let o = l + e,
                            a = Math.min(n, o),
                            i = o - a;
                          ((r.style.height = a + "px"),
                            "0px" === r.style.bottom &&
                              ((t.scrollTop = i > 0 ? i : 0),
                              (r.style.justifyContent = "flex-end")));
                        }
                      }
                    }
                    d.current = t.scrollTop;
                  }),
                }),
              }),
            ],
          });
        });
      el.displayName = en;
      var eo = "SelectGroup",
        [ea, ei] = M(eo),
        es = n.forwardRef((e, t) => {
          let { __scopeSelect: r, ...n } = e,
            l = (0, h.B)();
          return (0, I.jsx)(ea, {
            scope: r,
            id: l,
            children: (0, I.jsx)(w.sG.div, { role: "group", "aria-labelledby": l, ...n, ref: t }),
          });
        });
      es.displayName = eo;
      var ec = "SelectLabel",
        eu = n.forwardRef((e, t) => {
          let { __scopeSelect: r, ...n } = e,
            l = ei(ec, r);
          return (0, I.jsx)(w.sG.div, { id: l.id, ...n, ref: t });
        });
      eu.displayName = ec;
      var ed = "SelectItem",
        [ep, ef] = M(ed),
        eh = n.forwardRef((e, t) => {
          let { __scopeSelect: r, value: l, disabled: o = !1, textValue: i, ...c } = e,
            u = H(ed, r),
            d = Y(ed, r),
            p = u.value === l,
            [f, v] = n.useState(i ?? ""),
            [m, g] = n.useState(!1),
            x = (0, s.s)(t, (e) => d.itemRefCallback?.(e, l, o)),
            y = (0, h.B)(),
            S = n.useRef("touch"),
            b = () => {
              o || (u.onValueChange(l), u.onOpenChange(!1));
            };
          if ("" === l)
            throw Error(
              "A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder."
            );
          return (0, I.jsx)(ep, {
            scope: r,
            value: l,
            disabled: o,
            textId: y,
            isSelected: p,
            onItemTextChange: n.useCallback((e) => {
              v((t) => t || (e?.textContent ?? "").trim());
            }, []),
            children: (0, I.jsx)(P.ItemSlot, {
              scope: r,
              value: l,
              disabled: o,
              textValue: f,
              children: (0, I.jsx)(w.sG.div, {
                role: "option",
                "aria-labelledby": y,
                "data-highlighted": m ? "" : void 0,
                "aria-selected": p && m,
                "data-state": p ? "checked" : "unchecked",
                "aria-disabled": o || void 0,
                "data-disabled": o ? "" : void 0,
                tabIndex: o ? void 0 : -1,
                ...c,
                ref: x,
                onFocus: (0, a.m)(c.onFocus, () => g(!0)),
                onBlur: (0, a.m)(c.onBlur, () => g(!1)),
                onClick: (0, a.m)(c.onClick, () => {
                  "mouse" !== S.current && b();
                }),
                onPointerUp: (0, a.m)(c.onPointerUp, () => {
                  "mouse" === S.current && b();
                }),
                onPointerDown: (0, a.m)(c.onPointerDown, (e) => {
                  S.current = e.pointerType;
                }),
                onPointerMove: (0, a.m)(c.onPointerMove, (e) => {
                  ((S.current = e.pointerType),
                    o
                      ? d.onItemLeave?.()
                      : "mouse" === S.current && e.currentTarget.focus({ preventScroll: !0 }));
                }),
                onPointerLeave: (0, a.m)(c.onPointerLeave, (e) => {
                  e.currentTarget === document.activeElement && d.onItemLeave?.();
                }),
                onKeyDown: (0, a.m)(c.onKeyDown, (e) => {
                  (d.searchRef?.current === "" || " " !== e.key) &&
                    (N.includes(e.key) && b(), " " === e.key && e.preventDefault());
                }),
              }),
            }),
          });
        });
      eh.displayName = ed;
      var ev = "SelectItemText",
        em = n.forwardRef((e, t) => {
          let { __scopeSelect: r, className: o, style: a, ...i } = e,
            c = H(ev, r),
            u = Y(ev, r),
            d = ef(ev, r),
            p = V(ev, r),
            [f, h] = n.useState(null),
            v = (0, s.s)(
              t,
              (e) => h(e),
              d.onItemTextChange,
              (e) => u.itemTextRefCallback?.(e, d.value, d.disabled)
            ),
            m = f?.textContent,
            g = n.useMemo(
              () =>
                (0, I.jsx)(
                  "option",
                  { value: d.value, disabled: d.disabled, children: m },
                  d.value
                ),
              [d.disabled, d.value, m]
            ),
            { onNativeOptionAdd: x, onNativeOptionRemove: y } = p;
          return (
            (0, S.N)(() => (x(g), () => y(g)), [x, y, g]),
            (0, I.jsxs)(I.Fragment, {
              children: [
                (0, I.jsx)(w.sG.span, { id: d.textId, ...i, ref: v }),
                d.isSelected && c.valueNode && !c.valueNodeHasChildren
                  ? l.createPortal(i.children, c.valueNode)
                  : null,
              ],
            })
          );
        });
      em.displayName = ev;
      var ew = "SelectItemIndicator",
        eg = n.forwardRef((e, t) => {
          let { __scopeSelect: r, ...n } = e;
          return ef(ew, r).isSelected
            ? (0, I.jsx)(w.sG.span, { "aria-hidden": !0, ...n, ref: t })
            : null;
        });
      eg.displayName = ew;
      var ex = "SelectScrollUpButton",
        ey = n.forwardRef((e, t) => {
          let r = Y(ex, e.__scopeSelect),
            l = er(ex, e.__scopeSelect),
            [o, a] = n.useState(!1),
            i = (0, s.s)(t, l.onScrollButtonChange);
          return (
            (0, S.N)(() => {
              if (r.viewport && r.isPositioned) {
                let e = function () {
                    a(t.scrollTop > 0);
                  },
                  t = r.viewport;
                return (
                  e(),
                  t.addEventListener("scroll", e),
                  () => t.removeEventListener("scroll", e)
                );
              }
            }, [r.viewport, r.isPositioned]),
            o
              ? (0, I.jsx)(eC, {
                  ...e,
                  ref: i,
                  onAutoScroll: () => {
                    let { viewport: e, selectedItem: t } = r;
                    e && t && (e.scrollTop = e.scrollTop - t.offsetHeight);
                  },
                })
              : null
          );
        });
      ey.displayName = ex;
      var eS = "SelectScrollDownButton",
        eb = n.forwardRef((e, t) => {
          let r = Y(eS, e.__scopeSelect),
            l = er(eS, e.__scopeSelect),
            [o, a] = n.useState(!1),
            i = (0, s.s)(t, l.onScrollButtonChange);
          return (
            (0, S.N)(() => {
              if (r.viewport && r.isPositioned) {
                let e = function () {
                    let e = t.scrollHeight - t.clientHeight;
                    a(Math.ceil(t.scrollTop) < e);
                  },
                  t = r.viewport;
                return (
                  e(),
                  t.addEventListener("scroll", e),
                  () => t.removeEventListener("scroll", e)
                );
              }
            }, [r.viewport, r.isPositioned]),
            o
              ? (0, I.jsx)(eC, {
                  ...e,
                  ref: i,
                  onAutoScroll: () => {
                    let { viewport: e, selectedItem: t } = r;
                    e && t && (e.scrollTop = e.scrollTop + t.offsetHeight);
                  },
                })
              : null
          );
        });
      eb.displayName = eS;
      var eC = n.forwardRef((e, t) => {
          let { __scopeSelect: r, onAutoScroll: l, ...o } = e,
            i = Y("SelectScrollButton", r),
            s = n.useRef(null),
            c = E(r),
            u = n.useCallback(() => {
              null !== s.current && (window.clearInterval(s.current), (s.current = null));
            }, []);
          return (
            n.useEffect(() => () => u(), [u]),
            (0, S.N)(() => {
              let e = c().find((e) => e.ref.current === document.activeElement);
              e?.ref.current?.scrollIntoView({ block: "nearest" });
            }, [c]),
            (0, I.jsx)(w.sG.div, {
              "aria-hidden": !0,
              ...o,
              ref: t,
              style: { flexShrink: 0, ...o.style },
              onPointerDown: (0, a.m)(o.onPointerDown, () => {
                null === s.current && (s.current = window.setInterval(l, 50));
              }),
              onPointerMove: (0, a.m)(o.onPointerMove, () => {
                (i.onItemLeave?.(), null === s.current && (s.current = window.setInterval(l, 50)));
              }),
              onPointerLeave: (0, a.m)(o.onPointerLeave, () => {
                u();
              }),
            })
          );
        }),
        ej = n.forwardRef((e, t) => {
          let { __scopeSelect: r, ...n } = e;
          return (0, I.jsx)(w.sG.div, { "aria-hidden": !0, ...n, ref: t });
        });
      ej.displayName = "SelectSeparator";
      var eT = "SelectArrow",
        eI = n.forwardRef((e, t) => {
          let { __scopeSelect: r, ...n } = e,
            l = B(r),
            o = H(eT, r),
            a = Y(eT, r);
          return o.open && "popper" === a.position
            ? (0, I.jsx)(v.i3, { ...l, ...n, ref: t })
            : null;
        });
      eI.displayName = eT;
      var ek = n.forwardRef((e, t) => {
        let { __scopeSelect: r, value: l, ...o } = e,
          a = n.useRef(null),
          i = (0, s.s)(t, a),
          c = (0, b.Z)(l);
        return (
          n.useEffect(() => {
            let e = a.current;
            if (!e) return;
            let t = Object.getOwnPropertyDescriptor(
              window.HTMLSelectElement.prototype,
              "value"
            ).set;
            if (c !== l && t) {
              let r = new Event("change", { bubbles: !0 });
              (t.call(e, l), e.dispatchEvent(r));
            }
          }, [c, l]),
          (0, I.jsx)(w.sG.select, { ...o, style: { ...C.Qg, ...o.style }, ref: i, defaultValue: l })
        );
      });
      function eN(e) {
        return "" === e || void 0 === e;
      }
      function eR(e) {
        let t = (0, x.c)(e),
          r = n.useRef(""),
          l = n.useRef(0),
          o = n.useCallback(
            (e) => {
              let n = r.current + e;
              (t(n),
                (function e(t) {
                  ((r.current = t),
                    window.clearTimeout(l.current),
                    "" !== t && (l.current = window.setTimeout(() => e(""), 1e3)));
                })(n));
            },
            [t]
          ),
          a = n.useCallback(() => {
            ((r.current = ""), window.clearTimeout(l.current));
          }, []);
        return (n.useEffect(() => () => window.clearTimeout(l.current), []), [r, o, a]);
      }
      function eP(e, t, r) {
        var n, l;
        let o = t.length > 1 && Array.from(t).every((e) => e === t[0]) ? t[0] : t,
          a = r ? e.indexOf(r) : -1,
          i = ((n = e), (l = Math.max(a, 0)), n.map((e, t) => n[(l + t) % n.length]));
        1 === o.length && (i = i.filter((e) => e !== r));
        let s = i.find((e) => e.textValue.toLowerCase().startsWith(o.toLowerCase()));
        return s !== r ? s : void 0;
      }
      ek.displayName = "SelectBubbleInput";
      var eE = G,
        eD = O,
        eM = U,
        eL = W,
        eB = q,
        eA = Z,
        eH = el,
        e_ = es,
        eV = eu,
        eG = eh,
        eK = em,
        eO = eg,
        eF = ey,
        eU = eb,
        eW = ej,
        eq = eI;
    },
    78108: (e, t, r) => {
      r.d(t, { Z: () => l });
      var n = r(12115);
      function l(e) {
        let t = n.useRef({ value: e, previous: e });
        return n.useMemo(
          () => (
            t.current.value !== e &&
              ((t.current.previous = t.current.value), (t.current.value = e)),
            t.current.previous
          ),
          [e]
        );
      }
    },
  },
]);
