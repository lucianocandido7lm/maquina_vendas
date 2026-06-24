"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [6348],
  {
    11828: (e, r, n) => {
      n.d(r, {
        G5: () => eH,
        H_: () => eO,
        JU: () => eF,
        Mz: () => eS,
        Pb: () => ez,
        UC: () => eL,
        UE: () => T,
        VF: () => eU,
        YJ: () => eN,
        ZL: () => eT,
        ZP: () => eq,
        bL: () => eE,
        hN: () => eK,
        i3: () => eV,
        q7: () => eA,
        wv: () => eB,
        z6: () => eG,
      });
      var t = n(12115),
        o = n(92556),
        a = n(88167),
        u = n(94446),
        l = n(3468),
        i = n(66218),
        s = n(44831),
        d = n(19526),
        c = n(69666),
        p = n(68946),
        f = n(73867),
        m = n(75433),
        v = n(76842),
        w = n(97602),
        h = n(72431),
        g = n(32467),
        x = n(70222),
        b = n(97745),
        y = n(40101),
        M = n(95155),
        C = ["Enter", " "],
        D = ["ArrowUp", "PageDown", "End"],
        R = ["ArrowDown", "PageUp", "Home", ...D],
        j = { ltr: [...C, "ArrowRight"], rtl: [...C, "ArrowLeft"] },
        I = { ltr: ["ArrowLeft"], rtl: ["ArrowRight"] },
        _ = "Menu",
        [k, P, E] = (0, a.N)(_),
        [S, T] = (0, l.A)(_, [E, f.Bk, h.RG]),
        L = (0, f.Bk)(),
        N = (0, h.RG)(),
        [F, A] = S(_),
        [O, G] = S(_),
        K = (e) => {
          let {
              __scopeMenu: r,
              open: n = !1,
              children: o,
              dir: a,
              onOpenChange: u,
              modal: l = !0,
            } = e,
            s = L(r),
            [d, c] = t.useState(null),
            p = t.useRef(!1),
            m = (0, x.c)(u),
            v = (0, i.jH)(a);
          return (
            t.useEffect(() => {
              let e = () => {
                  ((p.current = !0),
                    document.addEventListener("pointerdown", r, { capture: !0, once: !0 }),
                    document.addEventListener("pointermove", r, { capture: !0, once: !0 }));
                },
                r = () => (p.current = !1);
              return (
                document.addEventListener("keydown", e, { capture: !0 }),
                () => {
                  (document.removeEventListener("keydown", e, { capture: !0 }),
                    document.removeEventListener("pointerdown", r, { capture: !0 }),
                    document.removeEventListener("pointermove", r, { capture: !0 }));
                }
              );
            }, []),
            (0, M.jsx)(f.bL, {
              ...s,
              children: (0, M.jsx)(F, {
                scope: r,
                open: n,
                onOpenChange: m,
                content: d,
                onContentChange: c,
                children: (0, M.jsx)(O, {
                  scope: r,
                  onClose: t.useCallback(() => m(!1), [m]),
                  isUsingKeyboardRef: p,
                  dir: v,
                  modal: l,
                  children: o,
                }),
              }),
            })
          );
        };
      K.displayName = _;
      var U = t.forwardRef((e, r) => {
        let { __scopeMenu: n, ...t } = e,
          o = L(n);
        return (0, M.jsx)(f.Mz, { ...o, ...t, ref: r });
      });
      U.displayName = "MenuAnchor";
      var B = "MenuPortal",
        [V, z] = S(B, { forceMount: void 0 }),
        q = (e) => {
          let { __scopeMenu: r, forceMount: n, children: t, container: o } = e,
            a = A(B, r);
          return (0, M.jsx)(V, {
            scope: r,
            forceMount: n,
            children: (0, M.jsx)(v.C, {
              present: n || a.open,
              children: (0, M.jsx)(m.Portal, { asChild: !0, container: o, children: t }),
            }),
          });
        };
      q.displayName = B;
      var H = "MenuContent",
        [X, Z] = S(H),
        J = t.forwardRef((e, r) => {
          let n = z(H, e.__scopeMenu),
            { forceMount: t = n.forceMount, ...o } = e,
            a = A(H, e.__scopeMenu),
            u = G(H, e.__scopeMenu);
          return (0, M.jsx)(k.Provider, {
            scope: e.__scopeMenu,
            children: (0, M.jsx)(v.C, {
              present: t || a.open,
              children: (0, M.jsx)(k.Slot, {
                scope: e.__scopeMenu,
                children: u.modal
                  ? (0, M.jsx)(Y, { ...o, ref: r })
                  : (0, M.jsx)(W, { ...o, ref: r }),
              }),
            }),
          });
        }),
        Y = t.forwardRef((e, r) => {
          let n = A(H, e.__scopeMenu),
            a = t.useRef(null),
            l = (0, u.s)(r, a);
          return (
            t.useEffect(() => {
              let e = a.current;
              if (e) return (0, b.Eq)(e);
            }, []),
            (0, M.jsx)($, {
              ...e,
              ref: l,
              trapFocus: n.open,
              disableOutsidePointerEvents: n.open,
              disableOutsideScroll: !0,
              onFocusOutside: (0, o.m)(e.onFocusOutside, (e) => e.preventDefault(), {
                checkForDefaultPrevented: !1,
              }),
              onDismiss: () => n.onOpenChange(!1),
            })
          );
        }),
        W = t.forwardRef((e, r) => {
          let n = A(H, e.__scopeMenu);
          return (0, M.jsx)($, {
            ...e,
            ref: r,
            trapFocus: !1,
            disableOutsidePointerEvents: !1,
            disableOutsideScroll: !1,
            onDismiss: () => n.onOpenChange(!1),
          });
        }),
        Q = (0, g.TL)("MenuContent.ScrollLock"),
        $ = t.forwardRef((e, r) => {
          let {
              __scopeMenu: n,
              loop: a = !1,
              trapFocus: l,
              onOpenAutoFocus: i,
              onCloseAutoFocus: p,
              disableOutsidePointerEvents: m,
              onEntryFocus: v,
              onEscapeKeyDown: w,
              onPointerDownOutside: g,
              onFocusOutside: x,
              onInteractOutside: b,
              onDismiss: C,
              disableOutsideScroll: j,
              ...I
            } = e,
            _ = A(H, n),
            k = G(H, n),
            E = L(n),
            S = N(n),
            T = P(n),
            [F, O] = t.useState(null),
            K = t.useRef(null),
            U = (0, u.s)(r, K, _.onContentChange),
            B = t.useRef(0),
            V = t.useRef(""),
            z = t.useRef(0),
            q = t.useRef(null),
            Z = t.useRef("right"),
            J = t.useRef(0),
            Y = j ? y.A : t.Fragment;
          (t.useEffect(() => () => window.clearTimeout(B.current), []), (0, d.Oh)());
          let W = t.useCallback(
            (e) =>
              Z.current === q.current?.side &&
              (function (e, r) {
                return (
                  !!r &&
                  (function (e, r) {
                    let { x: n, y: t } = e,
                      o = !1;
                    for (let e = 0, a = r.length - 1; e < r.length; a = e++) {
                      let u = r[e],
                        l = r[a],
                        i = u.x,
                        s = u.y,
                        d = l.x,
                        c = l.y;
                      s > t != c > t && n < ((d - i) * (t - s)) / (c - s) + i && (o = !o);
                    }
                    return o;
                  })({ x: e.clientX, y: e.clientY }, r)
                );
              })(e, q.current?.area),
            []
          );
          return (0, M.jsx)(X, {
            scope: n,
            searchRef: V,
            onItemEnter: t.useCallback(
              (e) => {
                W(e) && e.preventDefault();
              },
              [W]
            ),
            onItemLeave: t.useCallback(
              (e) => {
                W(e) || (K.current?.focus(), O(null));
              },
              [W]
            ),
            onTriggerLeave: t.useCallback(
              (e) => {
                W(e) && e.preventDefault();
              },
              [W]
            ),
            pointerGraceTimerRef: z,
            onPointerGraceIntentChange: t.useCallback((e) => {
              q.current = e;
            }, []),
            children: (0, M.jsx)(Y, {
              ...(j ? { as: Q, allowPinchZoom: !0 } : void 0),
              children: (0, M.jsx)(c.n, {
                asChild: !0,
                trapped: l,
                onMountAutoFocus: (0, o.m)(i, (e) => {
                  (e.preventDefault(), K.current?.focus({ preventScroll: !0 }));
                }),
                onUnmountAutoFocus: p,
                children: (0, M.jsx)(s.qW, {
                  asChild: !0,
                  disableOutsidePointerEvents: m,
                  onEscapeKeyDown: w,
                  onPointerDownOutside: g,
                  onFocusOutside: x,
                  onInteractOutside: b,
                  onDismiss: C,
                  children: (0, M.jsx)(h.bL, {
                    asChild: !0,
                    ...S,
                    dir: k.dir,
                    orientation: "vertical",
                    loop: a,
                    currentTabStopId: F,
                    onCurrentTabStopIdChange: O,
                    onEntryFocus: (0, o.m)(v, (e) => {
                      k.isUsingKeyboardRef.current || e.preventDefault();
                    }),
                    preventScrollOnEntryFocus: !0,
                    children: (0, M.jsx)(f.UC, {
                      role: "menu",
                      "aria-orientation": "vertical",
                      "data-state": eI(_.open),
                      "data-radix-menu-content": "",
                      dir: k.dir,
                      ...E,
                      ...I,
                      ref: U,
                      style: { outline: "none", ...I.style },
                      onKeyDown: (0, o.m)(I.onKeyDown, (e) => {
                        let r = e.target.closest("[data-radix-menu-content]") === e.currentTarget,
                          n = e.ctrlKey || e.altKey || e.metaKey,
                          t = 1 === e.key.length;
                        r &&
                          ("Tab" === e.key && e.preventDefault(),
                          !n &&
                            t &&
                            ((e) => {
                              let r = V.current + e,
                                n = T().filter((e) => !e.disabled),
                                t = document.activeElement,
                                o = n.find((e) => e.ref.current === t)?.textValue,
                                a = (function (e, r, n) {
                                  var t;
                                  let o =
                                      r.length > 1 && Array.from(r).every((e) => e === r[0])
                                        ? r[0]
                                        : r,
                                    a = n ? e.indexOf(n) : -1,
                                    u =
                                      ((t = Math.max(a, 0)),
                                      e.map((r, n) => e[(t + n) % e.length]));
                                  1 === o.length && (u = u.filter((e) => e !== n));
                                  let l = u.find((e) =>
                                    e.toLowerCase().startsWith(o.toLowerCase())
                                  );
                                  return l !== n ? l : void 0;
                                })(
                                  n.map((e) => e.textValue),
                                  r,
                                  o
                                ),
                                u = n.find((e) => e.textValue === a)?.ref.current;
                              (!(function e(r) {
                                ((V.current = r),
                                  window.clearTimeout(B.current),
                                  "" !== r && (B.current = window.setTimeout(() => e(""), 1e3)));
                              })(r),
                                u && setTimeout(() => u.focus()));
                            })(e.key));
                        let o = K.current;
                        if (e.target !== o || !R.includes(e.key)) return;
                        e.preventDefault();
                        let a = T()
                          .filter((e) => !e.disabled)
                          .map((e) => e.ref.current);
                        (D.includes(e.key) && a.reverse(),
                          (function (e) {
                            let r = document.activeElement;
                            for (let n of e)
                              if (n === r || (n.focus(), document.activeElement !== r)) return;
                          })(a));
                      }),
                      onBlur: (0, o.m)(e.onBlur, (e) => {
                        e.currentTarget.contains(e.target) ||
                          (window.clearTimeout(B.current), (V.current = ""));
                      }),
                      onPointerMove: (0, o.m)(
                        e.onPointerMove,
                        eP((e) => {
                          let r = e.target,
                            n = J.current !== e.clientX;
                          e.currentTarget.contains(r) &&
                            n &&
                            ((Z.current = e.clientX > J.current ? "right" : "left"),
                            (J.current = e.clientX));
                        })
                      ),
                    }),
                  }),
                }),
              }),
            }),
          });
        });
      J.displayName = H;
      var ee = t.forwardRef((e, r) => {
        let { __scopeMenu: n, ...t } = e;
        return (0, M.jsx)(w.sG.div, { role: "group", ...t, ref: r });
      });
      ee.displayName = "MenuGroup";
      var er = t.forwardRef((e, r) => {
        let { __scopeMenu: n, ...t } = e;
        return (0, M.jsx)(w.sG.div, { ...t, ref: r });
      });
      er.displayName = "MenuLabel";
      var en = "MenuItem",
        et = "menu.itemSelect",
        eo = t.forwardRef((e, r) => {
          let { disabled: n = !1, onSelect: a, ...l } = e,
            i = t.useRef(null),
            s = G(en, e.__scopeMenu),
            d = Z(en, e.__scopeMenu),
            c = (0, u.s)(r, i),
            p = t.useRef(!1);
          return (0, M.jsx)(ea, {
            ...l,
            ref: c,
            disabled: n,
            onClick: (0, o.m)(e.onClick, () => {
              let e = i.current;
              if (!n && e) {
                let r = new CustomEvent(et, { bubbles: !0, cancelable: !0 });
                (e.addEventListener(et, (e) => a?.(e), { once: !0 }),
                  (0, w.hO)(e, r),
                  r.defaultPrevented ? (p.current = !1) : s.onClose());
              }
            }),
            onPointerDown: (r) => {
              (e.onPointerDown?.(r), (p.current = !0));
            },
            onPointerUp: (0, o.m)(e.onPointerUp, (e) => {
              p.current || e.currentTarget?.click();
            }),
            onKeyDown: (0, o.m)(e.onKeyDown, (e) => {
              let r = "" !== d.searchRef.current;
              n ||
                (r && " " === e.key) ||
                (C.includes(e.key) && (e.currentTarget.click(), e.preventDefault()));
            }),
          });
        });
      eo.displayName = en;
      var ea = t.forwardRef((e, r) => {
          let { __scopeMenu: n, disabled: a = !1, textValue: l, ...i } = e,
            s = Z(en, n),
            d = N(n),
            c = t.useRef(null),
            p = (0, u.s)(r, c),
            [f, m] = t.useState(!1),
            [v, g] = t.useState("");
          return (
            t.useEffect(() => {
              let e = c.current;
              e && g((e.textContent ?? "").trim());
            }, [i.children]),
            (0, M.jsx)(k.ItemSlot, {
              scope: n,
              disabled: a,
              textValue: l ?? v,
              children: (0, M.jsx)(h.q7, {
                asChild: !0,
                ...d,
                focusable: !a,
                children: (0, M.jsx)(w.sG.div, {
                  role: "menuitem",
                  "data-highlighted": f ? "" : void 0,
                  "aria-disabled": a || void 0,
                  "data-disabled": a ? "" : void 0,
                  ...i,
                  ref: p,
                  onPointerMove: (0, o.m)(
                    e.onPointerMove,
                    eP((e) => {
                      a
                        ? s.onItemLeave(e)
                        : (s.onItemEnter(e),
                          e.defaultPrevented || e.currentTarget.focus({ preventScroll: !0 }));
                    })
                  ),
                  onPointerLeave: (0, o.m)(
                    e.onPointerLeave,
                    eP((e) => s.onItemLeave(e))
                  ),
                  onFocus: (0, o.m)(e.onFocus, () => m(!0)),
                  onBlur: (0, o.m)(e.onBlur, () => m(!1)),
                }),
              }),
            })
          );
        }),
        eu = t.forwardRef((e, r) => {
          let { checked: n = !1, onCheckedChange: t, ...a } = e;
          return (0, M.jsx)(em, {
            scope: e.__scopeMenu,
            checked: n,
            children: (0, M.jsx)(eo, {
              role: "menuitemcheckbox",
              "aria-checked": e_(n) ? "mixed" : n,
              ...a,
              ref: r,
              "data-state": ek(n),
              onSelect: (0, o.m)(a.onSelect, () => t?.(!!e_(n) || !n), {
                checkForDefaultPrevented: !1,
              }),
            }),
          });
        });
      eu.displayName = "MenuCheckboxItem";
      var el = "MenuRadioGroup",
        [ei, es] = S(el, { value: void 0, onValueChange: () => {} }),
        ed = t.forwardRef((e, r) => {
          let { value: n, onValueChange: t, ...o } = e,
            a = (0, x.c)(t);
          return (0, M.jsx)(ei, {
            scope: e.__scopeMenu,
            value: n,
            onValueChange: a,
            children: (0, M.jsx)(ee, { ...o, ref: r }),
          });
        });
      ed.displayName = el;
      var ec = "MenuRadioItem",
        ep = t.forwardRef((e, r) => {
          let { value: n, ...t } = e,
            a = es(ec, e.__scopeMenu),
            u = n === a.value;
          return (0, M.jsx)(em, {
            scope: e.__scopeMenu,
            checked: u,
            children: (0, M.jsx)(eo, {
              role: "menuitemradio",
              "aria-checked": u,
              ...t,
              ref: r,
              "data-state": ek(u),
              onSelect: (0, o.m)(t.onSelect, () => a.onValueChange?.(n), {
                checkForDefaultPrevented: !1,
              }),
            }),
          });
        });
      ep.displayName = ec;
      var ef = "MenuItemIndicator",
        [em, ev] = S(ef, { checked: !1 }),
        ew = t.forwardRef((e, r) => {
          let { __scopeMenu: n, forceMount: t, ...o } = e,
            a = ev(ef, n);
          return (0, M.jsx)(v.C, {
            present: t || e_(a.checked) || !0 === a.checked,
            children: (0, M.jsx)(w.sG.span, { ...o, ref: r, "data-state": ek(a.checked) }),
          });
        });
      ew.displayName = ef;
      var eh = t.forwardRef((e, r) => {
        let { __scopeMenu: n, ...t } = e;
        return (0, M.jsx)(w.sG.div, {
          role: "separator",
          "aria-orientation": "horizontal",
          ...t,
          ref: r,
        });
      });
      eh.displayName = "MenuSeparator";
      var eg = t.forwardRef((e, r) => {
        let { __scopeMenu: n, ...t } = e,
          o = L(n);
        return (0, M.jsx)(f.i3, { ...o, ...t, ref: r });
      });
      eg.displayName = "MenuArrow";
      var ex = "MenuSub",
        [eb, ey] = S(ex),
        eM = (e) => {
          let { __scopeMenu: r, children: n, open: o = !1, onOpenChange: a } = e,
            u = A(ex, r),
            l = L(r),
            [i, s] = t.useState(null),
            [d, c] = t.useState(null),
            m = (0, x.c)(a);
          return (
            t.useEffect(() => (!1 === u.open && m(!1), () => m(!1)), [u.open, m]),
            (0, M.jsx)(f.bL, {
              ...l,
              children: (0, M.jsx)(F, {
                scope: r,
                open: o,
                onOpenChange: m,
                content: d,
                onContentChange: c,
                children: (0, M.jsx)(eb, {
                  scope: r,
                  contentId: (0, p.B)(),
                  triggerId: (0, p.B)(),
                  trigger: i,
                  onTriggerChange: s,
                  children: n,
                }),
              }),
            })
          );
        };
      eM.displayName = ex;
      var eC = "MenuSubTrigger",
        eD = t.forwardRef((e, r) => {
          let n = A(eC, e.__scopeMenu),
            a = G(eC, e.__scopeMenu),
            l = ey(eC, e.__scopeMenu),
            i = Z(eC, e.__scopeMenu),
            s = t.useRef(null),
            { pointerGraceTimerRef: d, onPointerGraceIntentChange: c } = i,
            p = { __scopeMenu: e.__scopeMenu },
            f = t.useCallback(() => {
              (s.current && window.clearTimeout(s.current), (s.current = null));
            }, []);
          return (
            t.useEffect(() => f, [f]),
            t.useEffect(() => {
              let e = d.current;
              return () => {
                (window.clearTimeout(e), c(null));
              };
            }, [d, c]),
            (0, M.jsx)(U, {
              asChild: !0,
              ...p,
              children: (0, M.jsx)(ea, {
                id: l.triggerId,
                "aria-haspopup": "menu",
                "aria-expanded": n.open,
                "aria-controls": l.contentId,
                "data-state": eI(n.open),
                ...e,
                ref: (0, u.t)(r, l.onTriggerChange),
                onClick: (r) => {
                  (e.onClick?.(r),
                    e.disabled ||
                      r.defaultPrevented ||
                      (r.currentTarget.focus(), n.open || n.onOpenChange(!0)));
                },
                onPointerMove: (0, o.m)(
                  e.onPointerMove,
                  eP((r) => {
                    (i.onItemEnter(r),
                      !r.defaultPrevented &&
                        (e.disabled ||
                          n.open ||
                          s.current ||
                          (i.onPointerGraceIntentChange(null),
                          (s.current = window.setTimeout(() => {
                            (n.onOpenChange(!0), f());
                          }, 100)))));
                  })
                ),
                onPointerLeave: (0, o.m)(
                  e.onPointerLeave,
                  eP((e) => {
                    f();
                    let r = n.content?.getBoundingClientRect();
                    if (r) {
                      let t = n.content?.dataset.side,
                        o = "right" === t,
                        a = r[o ? "left" : "right"],
                        u = r[o ? "right" : "left"];
                      (i.onPointerGraceIntentChange({
                        area: [
                          { x: e.clientX + (o ? -5 : 5), y: e.clientY },
                          { x: a, y: r.top },
                          { x: u, y: r.top },
                          { x: u, y: r.bottom },
                          { x: a, y: r.bottom },
                        ],
                        side: t,
                      }),
                        window.clearTimeout(d.current),
                        (d.current = window.setTimeout(
                          () => i.onPointerGraceIntentChange(null),
                          300
                        )));
                    } else {
                      if ((i.onTriggerLeave(e), e.defaultPrevented)) return;
                      i.onPointerGraceIntentChange(null);
                    }
                  })
                ),
                onKeyDown: (0, o.m)(e.onKeyDown, (r) => {
                  let t = "" !== i.searchRef.current;
                  e.disabled ||
                    (t && " " === r.key) ||
                    (j[a.dir].includes(r.key) &&
                      (n.onOpenChange(!0), n.content?.focus(), r.preventDefault()));
                }),
              }),
            })
          );
        });
      eD.displayName = eC;
      var eR = "MenuSubContent",
        ej = t.forwardRef((e, r) => {
          let n = z(H, e.__scopeMenu),
            { forceMount: a = n.forceMount, ...l } = e,
            i = A(H, e.__scopeMenu),
            s = G(H, e.__scopeMenu),
            d = ey(eR, e.__scopeMenu),
            c = t.useRef(null),
            p = (0, u.s)(r, c);
          return (0, M.jsx)(k.Provider, {
            scope: e.__scopeMenu,
            children: (0, M.jsx)(v.C, {
              present: a || i.open,
              children: (0, M.jsx)(k.Slot, {
                scope: e.__scopeMenu,
                children: (0, M.jsx)($, {
                  id: d.contentId,
                  "aria-labelledby": d.triggerId,
                  ...l,
                  ref: p,
                  align: "start",
                  side: "rtl" === s.dir ? "left" : "right",
                  disableOutsidePointerEvents: !1,
                  disableOutsideScroll: !1,
                  trapFocus: !1,
                  onOpenAutoFocus: (e) => {
                    (s.isUsingKeyboardRef.current && c.current?.focus(), e.preventDefault());
                  },
                  onCloseAutoFocus: (e) => e.preventDefault(),
                  onFocusOutside: (0, o.m)(e.onFocusOutside, (e) => {
                    e.target !== d.trigger && i.onOpenChange(!1);
                  }),
                  onEscapeKeyDown: (0, o.m)(e.onEscapeKeyDown, (e) => {
                    (s.onClose(), e.preventDefault());
                  }),
                  onKeyDown: (0, o.m)(e.onKeyDown, (e) => {
                    let r = e.currentTarget.contains(e.target),
                      n = I[s.dir].includes(e.key);
                    r && n && (i.onOpenChange(!1), d.trigger?.focus(), e.preventDefault());
                  }),
                }),
              }),
            }),
          });
        });
      function eI(e) {
        return e ? "open" : "closed";
      }
      function e_(e) {
        return "indeterminate" === e;
      }
      function ek(e) {
        return e_(e) ? "indeterminate" : e ? "checked" : "unchecked";
      }
      function eP(e) {
        return (r) => ("mouse" === r.pointerType ? e(r) : void 0);
      }
      ej.displayName = eR;
      var eE = K,
        eS = U,
        eT = q,
        eL = J,
        eN = ee,
        eF = er,
        eA = eo,
        eO = eu,
        eG = ed,
        eK = ep,
        eU = ew,
        eB = eh,
        eV = eg,
        ez = eM,
        eq = eD,
        eH = ej;
    },
    56348: (e, r, n) => {
      (n.r(r),
        n.d(r, {
          Arrow: () => Z,
          CheckboxItem: () => V,
          Content: () => G,
          DropdownMenu: () => g,
          DropdownMenuArrow: () => S,
          DropdownMenuCheckboxItem: () => I,
          DropdownMenuContent: () => C,
          DropdownMenuGroup: () => D,
          DropdownMenuItem: () => j,
          DropdownMenuItemIndicator: () => P,
          DropdownMenuLabel: () => R,
          DropdownMenuPortal: () => y,
          DropdownMenuRadioGroup: () => _,
          DropdownMenuRadioItem: () => k,
          DropdownMenuSeparator: () => E,
          DropdownMenuSub: () => T,
          DropdownMenuSubContent: () => N,
          DropdownMenuSubTrigger: () => L,
          DropdownMenuTrigger: () => b,
          Group: () => K,
          Item: () => B,
          ItemIndicator: () => H,
          Label: () => U,
          Portal: () => O,
          RadioGroup: () => z,
          RadioItem: () => q,
          Root: () => F,
          Separator: () => X,
          Sub: () => J,
          SubContent: () => W,
          SubTrigger: () => Y,
          Trigger: () => A,
          createDropdownMenuScope: () => m,
        }));
      var t = n(12115),
        o = n(92556),
        a = n(94446),
        u = n(3468),
        l = n(23558),
        i = n(97602),
        s = n(11828),
        d = n(68946),
        c = n(95155),
        p = "DropdownMenu",
        [f, m] = (0, u.A)(p, [s.UE]),
        v = (0, s.UE)(),
        [w, h] = f(p),
        g = (e) => {
          let {
              __scopeDropdownMenu: r,
              children: n,
              dir: o,
              open: a,
              defaultOpen: u,
              onOpenChange: i,
              modal: f = !0,
            } = e,
            m = v(r),
            h = t.useRef(null),
            [g, x] = (0, l.i)({ prop: a, defaultProp: u ?? !1, onChange: i, caller: p });
          return (0, c.jsx)(w, {
            scope: r,
            triggerId: (0, d.B)(),
            triggerRef: h,
            contentId: (0, d.B)(),
            open: g,
            onOpenChange: x,
            onOpenToggle: t.useCallback(() => x((e) => !e), [x]),
            modal: f,
            children: (0, c.jsx)(s.bL, {
              ...m,
              open: g,
              onOpenChange: x,
              dir: o,
              modal: f,
              children: n,
            }),
          });
        };
      g.displayName = p;
      var x = "DropdownMenuTrigger",
        b = t.forwardRef((e, r) => {
          let { __scopeDropdownMenu: n, disabled: t = !1, ...u } = e,
            l = h(x, n),
            d = v(n);
          return (0, c.jsx)(s.Mz, {
            asChild: !0,
            ...d,
            children: (0, c.jsx)(i.sG.button, {
              type: "button",
              id: l.triggerId,
              "aria-haspopup": "menu",
              "aria-expanded": l.open,
              "aria-controls": l.open ? l.contentId : void 0,
              "data-state": l.open ? "open" : "closed",
              "data-disabled": t ? "" : void 0,
              disabled: t,
              ...u,
              ref: (0, a.t)(r, l.triggerRef),
              onPointerDown: (0, o.m)(e.onPointerDown, (e) => {
                !t &&
                  0 === e.button &&
                  !1 === e.ctrlKey &&
                  (l.onOpenToggle(), l.open || e.preventDefault());
              }),
              onKeyDown: (0, o.m)(e.onKeyDown, (e) => {
                !t &&
                  (["Enter", " "].includes(e.key) && l.onOpenToggle(),
                  "ArrowDown" === e.key && l.onOpenChange(!0),
                  ["Enter", " ", "ArrowDown"].includes(e.key) && e.preventDefault());
              }),
            }),
          });
        });
      b.displayName = x;
      var y = (e) => {
        let { __scopeDropdownMenu: r, ...n } = e,
          t = v(r);
        return (0, c.jsx)(s.ZL, { ...t, ...n });
      };
      y.displayName = "DropdownMenuPortal";
      var M = "DropdownMenuContent",
        C = t.forwardRef((e, r) => {
          let { __scopeDropdownMenu: n, ...a } = e,
            u = h(M, n),
            l = v(n),
            i = t.useRef(!1);
          return (0, c.jsx)(s.UC, {
            id: u.contentId,
            "aria-labelledby": u.triggerId,
            ...l,
            ...a,
            ref: r,
            onCloseAutoFocus: (0, o.m)(e.onCloseAutoFocus, (e) => {
              (i.current || u.triggerRef.current?.focus(), (i.current = !1), e.preventDefault());
            }),
            onInteractOutside: (0, o.m)(e.onInteractOutside, (e) => {
              let r = e.detail.originalEvent,
                n = 0 === r.button && !0 === r.ctrlKey,
                t = 2 === r.button || n;
              (!u.modal || t) && (i.current = !0);
            }),
            style: {
              ...e.style,
              "--radix-dropdown-menu-content-transform-origin":
                "var(--radix-popper-transform-origin)",
              "--radix-dropdown-menu-content-available-width":
                "var(--radix-popper-available-width)",
              "--radix-dropdown-menu-content-available-height":
                "var(--radix-popper-available-height)",
              "--radix-dropdown-menu-trigger-width": "var(--radix-popper-anchor-width)",
              "--radix-dropdown-menu-trigger-height": "var(--radix-popper-anchor-height)",
            },
          });
        });
      C.displayName = M;
      var D = t.forwardRef((e, r) => {
        let { __scopeDropdownMenu: n, ...t } = e,
          o = v(n);
        return (0, c.jsx)(s.YJ, { ...o, ...t, ref: r });
      });
      D.displayName = "DropdownMenuGroup";
      var R = t.forwardRef((e, r) => {
        let { __scopeDropdownMenu: n, ...t } = e,
          o = v(n);
        return (0, c.jsx)(s.JU, { ...o, ...t, ref: r });
      });
      R.displayName = "DropdownMenuLabel";
      var j = t.forwardRef((e, r) => {
        let { __scopeDropdownMenu: n, ...t } = e,
          o = v(n);
        return (0, c.jsx)(s.q7, { ...o, ...t, ref: r });
      });
      j.displayName = "DropdownMenuItem";
      var I = t.forwardRef((e, r) => {
        let { __scopeDropdownMenu: n, ...t } = e,
          o = v(n);
        return (0, c.jsx)(s.H_, { ...o, ...t, ref: r });
      });
      I.displayName = "DropdownMenuCheckboxItem";
      var _ = t.forwardRef((e, r) => {
        let { __scopeDropdownMenu: n, ...t } = e,
          o = v(n);
        return (0, c.jsx)(s.z6, { ...o, ...t, ref: r });
      });
      _.displayName = "DropdownMenuRadioGroup";
      var k = t.forwardRef((e, r) => {
        let { __scopeDropdownMenu: n, ...t } = e,
          o = v(n);
        return (0, c.jsx)(s.hN, { ...o, ...t, ref: r });
      });
      k.displayName = "DropdownMenuRadioItem";
      var P = t.forwardRef((e, r) => {
        let { __scopeDropdownMenu: n, ...t } = e,
          o = v(n);
        return (0, c.jsx)(s.VF, { ...o, ...t, ref: r });
      });
      P.displayName = "DropdownMenuItemIndicator";
      var E = t.forwardRef((e, r) => {
        let { __scopeDropdownMenu: n, ...t } = e,
          o = v(n);
        return (0, c.jsx)(s.wv, { ...o, ...t, ref: r });
      });
      E.displayName = "DropdownMenuSeparator";
      var S = t.forwardRef((e, r) => {
        let { __scopeDropdownMenu: n, ...t } = e,
          o = v(n);
        return (0, c.jsx)(s.i3, { ...o, ...t, ref: r });
      });
      S.displayName = "DropdownMenuArrow";
      var T = (e) => {
          let { __scopeDropdownMenu: r, children: n, open: t, onOpenChange: o, defaultOpen: a } = e,
            u = v(r),
            [i, d] = (0, l.i)({
              prop: t,
              defaultProp: a ?? !1,
              onChange: o,
              caller: "DropdownMenuSub",
            });
          return (0, c.jsx)(s.Pb, { ...u, open: i, onOpenChange: d, children: n });
        },
        L = t.forwardRef((e, r) => {
          let { __scopeDropdownMenu: n, ...t } = e,
            o = v(n);
          return (0, c.jsx)(s.ZP, { ...o, ...t, ref: r });
        });
      L.displayName = "DropdownMenuSubTrigger";
      var N = t.forwardRef((e, r) => {
        let { __scopeDropdownMenu: n, ...t } = e,
          o = v(n);
        return (0, c.jsx)(s.G5, {
          ...o,
          ...t,
          ref: r,
          style: {
            ...e.style,
            "--radix-dropdown-menu-content-transform-origin":
              "var(--radix-popper-transform-origin)",
            "--radix-dropdown-menu-content-available-width": "var(--radix-popper-available-width)",
            "--radix-dropdown-menu-content-available-height":
              "var(--radix-popper-available-height)",
            "--radix-dropdown-menu-trigger-width": "var(--radix-popper-anchor-width)",
            "--radix-dropdown-menu-trigger-height": "var(--radix-popper-anchor-height)",
          },
        });
      });
      N.displayName = "DropdownMenuSubContent";
      var F = g,
        A = b,
        O = y,
        G = C,
        K = D,
        U = R,
        B = j,
        V = I,
        z = _,
        q = k,
        H = P,
        X = E,
        Z = S,
        J = T,
        Y = L,
        W = N;
    },
    72431: (e, r, n) => {
      n.d(r, { RG: () => y, bL: () => P, q7: () => E });
      var t = n(12115),
        o = n(92556),
        a = n(88167),
        u = n(94446),
        l = n(3468),
        i = n(68946),
        s = n(97602),
        d = n(70222),
        c = n(23558),
        p = n(66218),
        f = n(95155),
        m = "rovingFocusGroup.onEntryFocus",
        v = { bubbles: !1, cancelable: !0 },
        w = "RovingFocusGroup",
        [h, g, x] = (0, a.N)(w),
        [b, y] = (0, l.A)(w, [x]),
        [M, C] = b(w),
        D = t.forwardRef((e, r) =>
          (0, f.jsx)(h.Provider, {
            scope: e.__scopeRovingFocusGroup,
            children: (0, f.jsx)(h.Slot, {
              scope: e.__scopeRovingFocusGroup,
              children: (0, f.jsx)(R, { ...e, ref: r }),
            }),
          })
        );
      D.displayName = w;
      var R = t.forwardRef((e, r) => {
          let {
              __scopeRovingFocusGroup: n,
              orientation: a,
              loop: l = !1,
              dir: i,
              currentTabStopId: h,
              defaultCurrentTabStopId: x,
              onCurrentTabStopIdChange: b,
              onEntryFocus: y,
              preventScrollOnEntryFocus: C = !1,
              ...D
            } = e,
            R = t.useRef(null),
            j = (0, u.s)(r, R),
            I = (0, p.jH)(i),
            [_, P] = (0, c.i)({ prop: h, defaultProp: x ?? null, onChange: b, caller: w }),
            [E, S] = t.useState(!1),
            T = (0, d.c)(y),
            L = g(n),
            N = t.useRef(!1),
            [F, A] = t.useState(0);
          return (
            t.useEffect(() => {
              let e = R.current;
              if (e) return (e.addEventListener(m, T), () => e.removeEventListener(m, T));
            }, [T]),
            (0, f.jsx)(M, {
              scope: n,
              orientation: a,
              dir: I,
              loop: l,
              currentTabStopId: _,
              onItemFocus: t.useCallback((e) => P(e), [P]),
              onItemShiftTab: t.useCallback(() => S(!0), []),
              onFocusableItemAdd: t.useCallback(() => A((e) => e + 1), []),
              onFocusableItemRemove: t.useCallback(() => A((e) => e - 1), []),
              children: (0, f.jsx)(s.sG.div, {
                tabIndex: E || 0 === F ? -1 : 0,
                "data-orientation": a,
                ...D,
                ref: j,
                style: { outline: "none", ...e.style },
                onMouseDown: (0, o.m)(e.onMouseDown, () => {
                  N.current = !0;
                }),
                onFocus: (0, o.m)(e.onFocus, (e) => {
                  let r = !N.current;
                  if (e.target === e.currentTarget && r && !E) {
                    let r = new CustomEvent(m, v);
                    if ((e.currentTarget.dispatchEvent(r), !r.defaultPrevented)) {
                      let e = L().filter((e) => e.focusable);
                      k(
                        [e.find((e) => e.active), e.find((e) => e.id === _), ...e]
                          .filter(Boolean)
                          .map((e) => e.ref.current),
                        C
                      );
                    }
                  }
                  N.current = !1;
                }),
                onBlur: (0, o.m)(e.onBlur, () => S(!1)),
              }),
            })
          );
        }),
        j = "RovingFocusGroupItem",
        I = t.forwardRef((e, r) => {
          let {
              __scopeRovingFocusGroup: n,
              focusable: a = !0,
              active: u = !1,
              tabStopId: l,
              children: d,
              ...c
            } = e,
            p = (0, i.B)(),
            m = l || p,
            v = C(j, n),
            w = v.currentTabStopId === m,
            x = g(n),
            { onFocusableItemAdd: b, onFocusableItemRemove: y, currentTabStopId: M } = v;
          return (
            t.useEffect(() => {
              if (a) return (b(), () => y());
            }, [a, b, y]),
            (0, f.jsx)(h.ItemSlot, {
              scope: n,
              id: m,
              focusable: a,
              active: u,
              children: (0, f.jsx)(s.sG.span, {
                tabIndex: w ? 0 : -1,
                "data-orientation": v.orientation,
                ...c,
                ref: r,
                onMouseDown: (0, o.m)(e.onMouseDown, (e) => {
                  a ? v.onItemFocus(m) : e.preventDefault();
                }),
                onFocus: (0, o.m)(e.onFocus, () => v.onItemFocus(m)),
                onKeyDown: (0, o.m)(e.onKeyDown, (e) => {
                  if ("Tab" === e.key && e.shiftKey) return void v.onItemShiftTab();
                  if (e.target !== e.currentTarget) return;
                  let r = (function (e, r, n) {
                    var t;
                    let o =
                      ((t = e.key),
                      "rtl" !== n
                        ? t
                        : "ArrowLeft" === t
                          ? "ArrowRight"
                          : "ArrowRight" === t
                            ? "ArrowLeft"
                            : t);
                    if (
                      !("vertical" === r && ["ArrowLeft", "ArrowRight"].includes(o)) &&
                      !("horizontal" === r && ["ArrowUp", "ArrowDown"].includes(o))
                    )
                      return _[o];
                  })(e, v.orientation, v.dir);
                  if (void 0 !== r) {
                    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
                    e.preventDefault();
                    let n = x()
                      .filter((e) => e.focusable)
                      .map((e) => e.ref.current);
                    if ("last" === r) n.reverse();
                    else if ("prev" === r || "next" === r) {
                      "prev" === r && n.reverse();
                      let t = n.indexOf(e.currentTarget);
                      n = v.loop
                        ? (function (e, r) {
                            return e.map((n, t) => e[(r + t) % e.length]);
                          })(n, t + 1)
                        : n.slice(t + 1);
                    }
                    setTimeout(() => k(n));
                  }
                }),
                children:
                  "function" == typeof d ? d({ isCurrentTabStop: w, hasTabStop: null != M }) : d,
              }),
            })
          );
        });
      I.displayName = j;
      var _ = {
        ArrowLeft: "prev",
        ArrowUp: "prev",
        ArrowRight: "next",
        ArrowDown: "next",
        PageUp: "first",
        Home: "first",
        PageDown: "last",
        End: "last",
      };
      function k(e) {
        let r = arguments.length > 1 && void 0 !== arguments[1] && arguments[1],
          n = document.activeElement;
        for (let t of e)
          if (t === n || (t.focus({ preventScroll: r }), document.activeElement !== n)) return;
      }
      var P = D,
        E = I;
    },
  },
]);
