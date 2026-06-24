"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [3677],
  {
    44151: (e, t, a) => {
      a.d(t, { A: () => C });
      let l,
        s,
        i,
        r = "undefined" != typeof Intl ? new Intl.Segmenter() : 0,
        n = (e) =>
          "string" == typeof e
            ? n(document.querySelectorAll(e))
            : "length" in e
              ? Array.from(e)
              : [e],
        o = (e) => n(e).filter((e) => e instanceof HTMLElement),
        d = [],
        p = function () {},
        c = /\s+/g,
        m = RegExp(
          "\\p{RI}\\p{RI}|\\p{Emoji}(\\p{EMod}|\\u{FE0F}\\u{20E3}?|[\\u{E0020}-\\u{E007E}]+\\u{E007F})?(\\u{200D}\\p{Emoji}(\\p{EMod}|\\u{FE0F}\\u{20E3}?|[\\u{E0020}-\\u{E007E}]+\\u{E007F})?)*|.",
          "gu"
        ),
        u = { left: 0, top: 0, width: 0, height: 0 },
        h = (e, t) => {
          if (t) {
            let a = new Set(e.join("").match(t) || d),
              l = e.length,
              s,
              i,
              r,
              n;
            if (a.size) {
              for (; --l > -1; )
                for (r of ((i = e[l]), a))
                  if (r.startsWith(i) && r.length > i.length) {
                    for (s = 0, n = i; r.startsWith((n += e[l + ++s])) && n.length < r.length; );
                    if (s && n.length === r.length) {
                      ((e[l] = r), e.splice(l + 1, s));
                      break;
                    }
                  }
            }
          }
          return e;
        },
        g = (e) =>
          "inline" === window.getComputedStyle(e).display && (e.style.display = "inline-block"),
        f = (e, t, a) => t.insertBefore("string" == typeof e ? document.createTextNode(e) : e, a),
        b = (e, t, a) => {
          let l = t[e + "sClass"] || "",
            { tag: s = "div", aria: i = "auto", propIndex: r = !1 } = t,
            n = "line" === e ? "block" : "inline-block",
            o = l.indexOf("++") > -1,
            d = (t) => {
              let d = document.createElement(s),
                p = a.length + 1;
              return (
                l && (d.className = l + (o ? " " + l + p : "")),
                r && d.style.setProperty("--" + e, p + ""),
                "none" !== i && d.setAttribute("aria-hidden", "true"),
                "span" !== s && ((d.style.position = "relative"), (d.style.display = n)),
                (d.textContent = t),
                a.push(d),
                d
              );
            };
          return (o && (l = l.replace("++", "")), (d.collection = a), d);
        },
        v = (e, t, a, l, s, i, n, o, p, m) => {
          var u;
          let b = Array.from(e.childNodes),
            y = 0,
            { wordDelimiter: C, reduceWhiteSpace: w = !0, prepareText: x } = t,
            E = e.getBoundingClientRect(),
            M = E,
            T = !w && "pre" === window.getComputedStyle(e).whiteSpace.substring(0, 3),
            S = 0,
            L = a.collection,
            $,
            z,
            D,
            k,
            A,
            B,
            O,
            H,
            R,
            N,
            I,
            F,
            P,
            q,
            _,
            X,
            Y,
            j;
          for (
            "object" == typeof C
              ? ((D = C.delimiter || C), (z = C.replaceWith || ""))
              : (z = "" === C ? "" : C || " "),
              $ = " " !== z;
            y < b.length;
            y++
          )
            if (3 === (k = b[y]).nodeType) {
              for (
                _ = k.textContent || "",
                  w ? (_ = _.replace(c, " ")) : T && (_ = _.replace(/\n/g, z + "\n")),
                  x && (_ = x(_, e)),
                  k.textContent = _,
                  Y = (A = z || D ? _.split(D || z) : _.match(o) || d)[A.length - 1],
                  H = $ ? " " === Y.slice(-1) : !Y,
                  Y || A.pop(),
                  M = E,
                  (O = $ ? " " === A[0].charAt(0) : !A[0]) && f(" ", e, k),
                  A[0] || A.shift(),
                  h(A, p),
                  (i && m) || (k.textContent = ""),
                  R = 1;
                R <= A.length;
                R++
              )
                if (
                  ((X = A[R - 1]),
                  !w &&
                    T &&
                    "\n" === X.charAt(0) &&
                    (null == (u = k.previousSibling) || u.remove(),
                    f(document.createElement("br"), e, k),
                    (X = X.slice(1))),
                  w || "" !== X)
                )
                  if (" " === X) e.insertBefore(document.createTextNode(" "), k);
                  else {
                    if (
                      ($ && " " === X.charAt(0) && f(" ", e, k),
                      S && 1 === R && !O && L.indexOf(S.parentNode) > -1
                        ? (B = L[L.length - 1]).appendChild(document.createTextNode(l ? "" : X))
                        : (f((B = a(l ? "" : X)), e, k),
                          S && 1 === R && !O && B.insertBefore(S, B.firstChild)),
                      l)
                    )
                      for (
                        j = 0,
                          I = r
                            ? h(
                                [...r.segment(X)].map((e) => e.segment),
                                p
                              )
                            : X.match(o) || d;
                        j < I.length;
                        j++
                      )
                        B.appendChild(" " === I[j] ? document.createTextNode(" ") : l(I[j]));
                    if (i && m) {
                      if (
                        ((_ = k.textContent = _.substring(X.length + 1, _.length)),
                        (N = B.getBoundingClientRect()).top > M.top && N.left <= M.left)
                      ) {
                        for (F = e.cloneNode(), P = e.childNodes[0]; P && P !== B; )
                          ((q = P), (P = P.nextSibling), F.appendChild(q));
                        (e.parentNode.insertBefore(F, e), s && g(F));
                      }
                      M = N;
                    }
                    (R < A.length || H) &&
                      f(R >= A.length ? " " : $ && " " === X.slice(-1) ? " " + z : z, e, k);
                  }
                else f(z, e, k);
              (e.removeChild(k), (S = 0));
            } else
              1 === k.nodeType &&
                (n && n.indexOf(k) > -1
                  ? (L.indexOf(k.previousSibling) > -1 && L[L.length - 1].appendChild(k), (S = k))
                  : (v(k, t, a, l, s, i, n, o, p, !0), (S = 0)),
                s && g(k));
        },
        y = class e {
          constructor(e, t) {
            ((this.isSplit = !1),
              i || C.register(window.gsap),
              (this.elements = o(e)),
              (this.chars = []),
              (this.words = []),
              (this.lines = []),
              (this.masks = []),
              (this.vars = t),
              (this._split = () => this.isSplit && this.split(this.vars)));
            let a = [],
              l,
              s = () => {
                let e = a.length,
                  t;
                for (; e--; ) {
                  let l = (t = a[e]).element.offsetWidth;
                  if (l !== t.width) {
                    ((t.width = l), this._split());
                    return;
                  }
                }
              };
            ((this._data = {
              orig: a,
              obs:
                "undefined" != typeof ResizeObserver &&
                new ResizeObserver(() => {
                  (clearTimeout(l), (l = setTimeout(s, 200)));
                }),
            }),
              p(this),
              this.split(t));
          }
          split(e) {
            (this.isSplit && this.revert(), (this.vars = e = e || this.vars || {}));
            let {
                type: t = "chars,words,lines",
                aria: a = "auto",
                deepSlice: l = !0,
                smartWrap: i,
                onSplit: r,
                autoSplit: d = !1,
                specialChars: p,
                mask: c,
              } = this.vars,
              h = t.indexOf("lines") > -1,
              g = t.indexOf("chars") > -1,
              f = t.indexOf("words") > -1,
              y = g && !f && !h,
              C = p && ("push" in p ? RegExp("(?:" + p.join("|") + ")", "gu") : p),
              w = C ? RegExp(C.source + "|" + m.source, "gu") : m,
              x = !!e.ignore && o(e.ignore),
              { orig: E, animTime: M, obs: T } = this._data,
              S;
            return (
              (g || f || h) &&
                (this.elements.forEach((t, s) => {
                  ((E[s] = {
                    element: t,
                    html: t.innerHTML,
                    ariaL: t.getAttribute("aria-label"),
                    ariaH: t.getAttribute("aria-hidden"),
                  }),
                    "auto" === a
                      ? t.setAttribute("aria-label", (t.textContent || "").trim())
                      : "hidden" === a && t.setAttribute("aria-hidden", "true"));
                  let r = [],
                    o = [],
                    d = [],
                    p = g ? b("char", e, r) : null,
                    c = b("word", e, o),
                    m,
                    M,
                    T,
                    S;
                  if ((v(t, e, c, p, y, l && (h || y), x, w, C, !1), h)) {
                    let a,
                      l,
                      s = n(t.childNodes),
                      i =
                        ((a = b("line", e, d)),
                        (l = window.getComputedStyle(t).textAlign || "left"),
                        (e, i) => {
                          let r = a("");
                          for (r.style.textAlign = l, t.insertBefore(r, s[e]); e < i; e++)
                            r.appendChild(s[e]);
                          r.normalize();
                        }),
                      r,
                      o = [],
                      p = 0,
                      c = s.map((e) => (1 === e.nodeType ? e.getBoundingClientRect() : u)),
                      h = u;
                    for (m = 0; m < s.length; m++)
                      1 === (r = s[m]).nodeType &&
                        ("BR" === r.nodeName
                          ? (o.push(r), i(p, m + 1), (h = c[(p = m + 1)]))
                          : (m && c[m].top > h.top && c[m].left <= h.left && (i(p, m), (p = m)),
                            (h = c[m])));
                    (p < m && i(p, m),
                      o.forEach((e) => {
                        var t;
                        return null == (t = e.parentNode) ? void 0 : t.removeChild(e);
                      }));
                  }
                  if (!f) {
                    for (m = 0; m < o.length; m++)
                      if (((M = o[m]), g || !M.nextSibling || 3 !== M.nextSibling.nodeType))
                        if (i && !h) {
                          for (
                            (T = document.createElement("span")).style.whiteSpace = "nowrap";
                            M.firstChild;

                          )
                            T.appendChild(M.firstChild);
                          M.replaceWith(T);
                        } else M.replaceWith(...M.childNodes);
                      else
                        (S = M.nextSibling) &&
                          3 === S.nodeType &&
                          ((S.textContent = (M.textContent || "") + (S.textContent || "")),
                          M.remove());
                    ((o.length = 0), t.normalize());
                  }
                  (this.lines.push(...d), this.words.push(...o), this.chars.push(...r));
                }),
                c &&
                  this[c] &&
                  this.masks.push(
                    ...this[c].map((e) => {
                      let t = e.cloneNode();
                      return (
                        e.replaceWith(t),
                        t.appendChild(e),
                        e.className && (t.className = e.className.replace(/(\b\w+\b)/g, "$1-mask")),
                        (t.style.overflow = "clip"),
                        t
                      );
                    })
                  )),
              (this.isSplit = !0),
              s &&
                (d
                  ? s.addEventListener("loadingdone", this._split)
                  : "loading" === s.status && console.warn("SplitText called before fonts loaded")),
              (S = r && r(this)) && S.totalTime && (this._data.anim = M ? S.totalTime(M) : S),
              h &&
                d &&
                this.elements.forEach((e, t) => {
                  ((E[t].width = e.offsetWidth), T && T.observe(e));
                }),
              this
            );
          }
          revert() {
            var e, t;
            let { orig: a, anim: l, obs: i } = this._data;
            return (
              i && i.disconnect(),
              a.forEach(({ element: e, html: t, ariaL: a, ariaH: l }) => {
                ((e.innerHTML = t),
                  a ? e.setAttribute("aria-label", a) : e.removeAttribute("aria-label"),
                  l ? e.setAttribute("aria-hidden", l) : e.removeAttribute("aria-hidden"));
              }),
              (this.chars.length =
                this.words.length =
                this.lines.length =
                a.length =
                this.masks.length =
                  0),
              (this.isSplit = !1),
              null == s || s.removeEventListener("loadingdone", this._split),
              l && ((this._data.animTime = l.totalTime()), l.revert()),
              null == (t = (e = this.vars).onRevert) || t.call(e, this),
              this
            );
          }
          static create(t, a) {
            return new e(t, a);
          }
          static register(e) {
            ((l = l || e || window.gsap) && ((n = l.utils.toArray), (p = l.core.context || p)),
              !i && window.innerWidth > 0 && ((s = document.fonts), (i = !0)));
          }
        };
      y.version = "3.13.0";
      let C = y;
    },
    66115: (e, t, a) => {
      a.d(t, { U1: () => p, xA: () => c, FJ: () => i, dK: () => o, Ze: () => d });
      var l = a(37310),
        s = a(31397);
      function i(e) {
        let t,
          a,
          { swiper: i, extendParams: r, on: n, emit: o } = e,
          d = (0, l.a)();
        (r({
          mousewheel: {
            enabled: !1,
            releaseOnEdges: !1,
            invert: !1,
            forceToAxis: !1,
            sensitivity: 1,
            eventsTarget: "container",
            thresholdDelta: null,
            thresholdTime: null,
            noMousewheelClass: "swiper-no-mousewheel",
          },
        }),
          (i.mousewheel = { enabled: !1 }));
        let p = (0, s.d)(),
          c = [];
        function m() {
          i.enabled && (i.mouseEntered = !0);
        }
        function u() {
          i.enabled && (i.mouseEntered = !1);
        }
        function h(e) {
          return (
            !(
              (i.params.mousewheel.thresholdDelta &&
                e.delta < i.params.mousewheel.thresholdDelta) ||
              (i.params.mousewheel.thresholdTime &&
                (0, s.d)() - p < i.params.mousewheel.thresholdTime)
            ) &&
            (!!(e.delta >= 6 && (0, s.d)() - p < 60) ||
              (e.direction < 0
                ? (i.isEnd && !i.params.loop) || i.animating || (i.slideNext(), o("scroll", e.raw))
                : (i.isBeginning && !i.params.loop) ||
                  i.animating ||
                  (i.slidePrev(), o("scroll", e.raw)),
              (p = new d.Date().getTime()),
              !1))
          );
        }
        function g(e) {
          var l;
          let r,
            n,
            d,
            p,
            m = e;
          if (!i.enabled || e.target.closest(`.${i.params.mousewheel.noMousewheelClass}`)) return;
          let u = i.params.mousewheel;
          i.params.cssMode && m.preventDefault();
          let g = i.el;
          "container" !== i.params.mousewheel.eventsTarget &&
            (g = document.querySelector(i.params.mousewheel.eventsTarget));
          let f = g && g.contains(m.target);
          if (!i.mouseEntered && !f && !u.releaseOnEdges) return !0;
          m.originalEvent && (m = m.originalEvent);
          let b = 0,
            v = i.rtlTranslate ? -1 : 1,
            y =
              ((r = 0),
              (n = 0),
              (d = 0),
              (p = 0),
              "detail" in (l = m) && (n = l.detail),
              "wheelDelta" in l && (n = -l.wheelDelta / 120),
              "wheelDeltaY" in l && (n = -l.wheelDeltaY / 120),
              "wheelDeltaX" in l && (r = -l.wheelDeltaX / 120),
              "axis" in l && l.axis === l.HORIZONTAL_AXIS && ((r = n), (n = 0)),
              (d = 10 * r),
              (p = 10 * n),
              "deltaY" in l && (p = l.deltaY),
              "deltaX" in l && (d = l.deltaX),
              l.shiftKey && !d && ((d = p), (p = 0)),
              (d || p) &&
                l.deltaMode &&
                (1 === l.deltaMode ? ((d *= 40), (p *= 40)) : ((d *= 800), (p *= 800))),
              d && !r && (r = d < 1 ? -1 : 1),
              p && !n && (n = p < 1 ? -1 : 1),
              { spinX: r, spinY: n, pixelX: d, pixelY: p });
          if (u.forceToAxis)
            if (i.isHorizontal())
              if (!(Math.abs(y.pixelX) > Math.abs(y.pixelY))) return !0;
              else b = -y.pixelX * v;
            else {
              if (!(Math.abs(y.pixelY) > Math.abs(y.pixelX))) return !0;
              b = -y.pixelY;
            }
          else b = Math.abs(y.pixelX) > Math.abs(y.pixelY) ? -y.pixelX * v : -y.pixelY;
          if (0 === b) return !0;
          u.invert && (b = -b);
          let C = i.getTranslate() + b * u.sensitivity;
          if (
            (C >= i.minTranslate() && (C = i.minTranslate()),
            C <= i.maxTranslate() && (C = i.maxTranslate()),
            (i.params.loop || (C !== i.minTranslate() && C !== i.maxTranslate())) &&
              i.params.nested &&
              m.stopPropagation(),
            i.params.freeMode && i.params.freeMode.enabled)
          ) {
            let e = { time: (0, s.d)(), delta: Math.abs(b), direction: Math.sign(b) },
              l = a && e.time < a.time + 500 && e.delta <= a.delta && e.direction === a.direction;
            if (!l) {
              a = void 0;
              let r = i.getTranslate() + b * u.sensitivity,
                n = i.isBeginning,
                d = i.isEnd;
              if (
                (r >= i.minTranslate() && (r = i.minTranslate()),
                r <= i.maxTranslate() && (r = i.maxTranslate()),
                i.setTransition(0),
                i.setTranslate(r),
                i.updateProgress(),
                i.updateActiveIndex(),
                i.updateSlidesClasses(),
                ((!n && i.isBeginning) || (!d && i.isEnd)) && i.updateSlidesClasses(),
                i.params.loop &&
                  i.loopFix({ direction: e.direction < 0 ? "next" : "prev", byMousewheel: !0 }),
                i.params.freeMode.sticky)
              ) {
                (clearTimeout(t), (t = void 0), c.length >= 15 && c.shift());
                let l = c.length ? c[c.length - 1] : void 0,
                  r = c[0];
                if ((c.push(e), l && (e.delta > l.delta || e.direction !== l.direction)))
                  c.splice(0);
                else if (
                  c.length >= 15 &&
                  e.time - r.time < 500 &&
                  r.delta - e.delta >= 1 &&
                  e.delta <= 6
                ) {
                  let l = b > 0 ? 0.8 : 0.2;
                  ((a = e),
                    c.splice(0),
                    (t = (0, s.n)(() => {
                      !i.destroyed && i.params && i.slideToClosest(i.params.speed, !0, void 0, l);
                    }, 0)));
                }
                t ||
                  (t = (0, s.n)(() => {
                    !i.destroyed &&
                      i.params &&
                      ((a = e), c.splice(0), i.slideToClosest(i.params.speed, !0, void 0, 0.5));
                  }, 500));
              }
              if (
                (l || o("scroll", m),
                i.params.autoplay && i.params.autoplay.disableOnInteraction && i.autoplay.stop(),
                u.releaseOnEdges && (r === i.minTranslate() || r === i.maxTranslate()))
              )
                return !0;
            }
          } else {
            let t = { time: (0, s.d)(), delta: Math.abs(b), direction: Math.sign(b), raw: e };
            c.length >= 2 && c.shift();
            let a = c.length ? c[c.length - 1] : void 0;
            if (
              (c.push(t),
              a
                ? (t.direction !== a.direction || t.delta > a.delta || t.time > a.time + 150) &&
                  h(t)
                : h(t),
              (function (e) {
                let t = i.params.mousewheel;
                if (e.direction < 0) {
                  if (i.isEnd && !i.params.loop && t.releaseOnEdges) return !0;
                } else if (i.isBeginning && !i.params.loop && t.releaseOnEdges) return !0;
                return !1;
              })(t))
            )
              return !0;
          }
          return (m.preventDefault ? m.preventDefault() : (m.returnValue = !1), !1);
        }
        function f(e) {
          let t = i.el;
          ("container" !== i.params.mousewheel.eventsTarget &&
            (t = document.querySelector(i.params.mousewheel.eventsTarget)),
            t[e]("mouseenter", m),
            t[e]("mouseleave", u),
            t[e]("wheel", g));
        }
        function b() {
          return i.params.cssMode
            ? (i.wrapperEl.removeEventListener("wheel", g), !0)
            : !i.mousewheel.enabled && (f("addEventListener"), (i.mousewheel.enabled = !0), !0);
        }
        function v() {
          return i.params.cssMode
            ? (i.wrapperEl.addEventListener(event, g), !0)
            : !!i.mousewheel.enabled && (f("removeEventListener"), (i.mousewheel.enabled = !1), !0);
        }
        (n("init", () => {
          (!i.params.mousewheel.enabled && i.params.cssMode && v(),
            i.params.mousewheel.enabled && b());
        }),
          n("destroy", () => {
            (i.params.cssMode && b(), i.mousewheel.enabled && v());
          }),
          Object.assign(i.mousewheel, { enable: b, disable: v }));
      }
      function r(e, t, a, l) {
        return (
          e.params.createElements &&
            Object.keys(l).forEach((i) => {
              if (!a[i] && !0 === a.auto) {
                let r = (0, s.e)(e.el, `.${l[i]}`)[0];
                (r || (((r = (0, s.c)("div", l[i])).className = l[i]), e.el.append(r)),
                  (a[i] = r),
                  (t[i] = r));
              }
            }),
          a
        );
      }
      function n(e) {
        return (
          void 0 === e && (e = ""),
          `.${e
            .trim()
            .replace(/([\.:!+\/])/g, "\\$1")
            .replace(/ /g, ".")}`
        );
      }
      function o(e) {
        let t,
          { swiper: a, extendParams: l, on: i, emit: o } = e,
          d = "swiper-pagination";
        (l({
          pagination: {
            el: null,
            bulletElement: "span",
            clickable: !1,
            hideOnClick: !1,
            renderBullet: null,
            renderProgressbar: null,
            renderFraction: null,
            renderCustom: null,
            progressbarOpposite: !1,
            type: "bullets",
            dynamicBullets: !1,
            dynamicMainBullets: 1,
            formatFractionCurrent: (e) => e,
            formatFractionTotal: (e) => e,
            bulletClass: `${d}-bullet`,
            bulletActiveClass: `${d}-bullet-active`,
            modifierClass: `${d}-`,
            currentClass: `${d}-current`,
            totalClass: `${d}-total`,
            hiddenClass: `${d}-hidden`,
            progressbarFillClass: `${d}-progressbar-fill`,
            progressbarOppositeClass: `${d}-progressbar-opposite`,
            clickableClass: `${d}-clickable`,
            lockClass: `${d}-lock`,
            horizontalClass: `${d}-horizontal`,
            verticalClass: `${d}-vertical`,
            paginationDisabledClass: `${d}-disabled`,
          },
        }),
          (a.pagination = { el: null, bullets: [] }));
        let p = 0;
        function c() {
          return (
            !a.params.pagination.el ||
            !a.pagination.el ||
            (Array.isArray(a.pagination.el) && 0 === a.pagination.el.length)
          );
        }
        function m(e, t) {
          let { bulletActiveClass: l } = a.params.pagination;
          e &&
            (e = e[`${"prev" === t ? "previous" : "next"}ElementSibling`]) &&
            (e.classList.add(`${l}-${t}`),
            (e = e[`${"prev" === t ? "previous" : "next"}ElementSibling`]) &&
              e.classList.add(`${l}-${t}-${t}`));
        }
        function u(e) {
          let t = e.target.closest(n(a.params.pagination.bulletClass));
          if (!t) return;
          e.preventDefault();
          let l = (0, s.h)(t) * a.params.slidesPerGroup;
          if (a.params.loop) {
            var i, r, o;
            if (a.realIndex === l) return;
            let e =
              ((i = a.realIndex),
              (r = l),
              ((i %= o = a.slides.length), (r %= o) === i + 1)
                ? "next"
                : r === i - 1
                  ? "previous"
                  : void 0);
            "next" === e ? a.slideNext() : "previous" === e ? a.slidePrev() : a.slideToLoop(l);
          } else a.slideTo(l);
        }
        function h() {
          let e,
            l,
            i = a.rtl,
            r = a.params.pagination;
          if (c()) return;
          let d = a.pagination.el;
          d = (0, s.m)(d);
          let u = a.virtual && a.params.virtual.enabled ? a.virtual.slides.length : a.slides.length,
            h = a.params.loop ? Math.ceil(u / a.params.slidesPerGroup) : a.snapGrid.length;
          if (
            (a.params.loop
              ? ((l = a.previousRealIndex || 0),
                (e =
                  a.params.slidesPerGroup > 1
                    ? Math.floor(a.realIndex / a.params.slidesPerGroup)
                    : a.realIndex))
              : void 0 !== a.snapIndex
                ? ((e = a.snapIndex), (l = a.previousSnapIndex))
                : ((l = a.previousIndex || 0), (e = a.activeIndex || 0)),
            "bullets" === r.type && a.pagination.bullets && a.pagination.bullets.length > 0)
          ) {
            let n,
              o,
              c,
              u = a.pagination.bullets;
            if (
              (r.dynamicBullets &&
                ((t = (0, s.f)(u[0], a.isHorizontal() ? "width" : "height", !0)),
                d.forEach((e) => {
                  e.style[a.isHorizontal() ? "width" : "height"] =
                    `${t * (r.dynamicMainBullets + 4)}px`;
                }),
                r.dynamicMainBullets > 1 &&
                  void 0 !== l &&
                  ((p += e - (l || 0)) > r.dynamicMainBullets - 1
                    ? (p = r.dynamicMainBullets - 1)
                    : p < 0 && (p = 0)),
                (c =
                  ((o = (n = Math.max(e - p, 0)) + (Math.min(u.length, r.dynamicMainBullets) - 1)) +
                    n) /
                  2)),
              u.forEach((e) => {
                let t = [
                  ...["", "-next", "-next-next", "-prev", "-prev-prev", "-main"].map(
                    (e) => `${r.bulletActiveClass}${e}`
                  ),
                ]
                  .map((e) => ("string" == typeof e && e.includes(" ") ? e.split(" ") : e))
                  .flat();
                e.classList.remove(...t);
              }),
              d.length > 1)
            )
              u.forEach((t) => {
                let l = (0, s.h)(t);
                (l === e
                  ? t.classList.add(...r.bulletActiveClass.split(" "))
                  : a.isElement && t.setAttribute("part", "bullet"),
                  r.dynamicBullets &&
                    (l >= n &&
                      l <= o &&
                      t.classList.add(...`${r.bulletActiveClass}-main`.split(" ")),
                    l === n && m(t, "prev"),
                    l === o && m(t, "next")));
              });
            else {
              let t = u[e];
              if (
                (t && t.classList.add(...r.bulletActiveClass.split(" ")),
                a.isElement &&
                  u.forEach((t, a) => {
                    t.setAttribute("part", a === e ? "bullet-active" : "bullet");
                  }),
                r.dynamicBullets)
              ) {
                let e = u[n],
                  t = u[o];
                for (let e = n; e <= o; e += 1)
                  u[e] && u[e].classList.add(...`${r.bulletActiveClass}-main`.split(" "));
                (m(e, "prev"), m(t, "next"));
              }
            }
            if (r.dynamicBullets) {
              let e = Math.min(u.length, r.dynamicMainBullets + 4),
                l = (t * e - t) / 2 - c * t,
                s = i ? "right" : "left";
              u.forEach((e) => {
                e.style[a.isHorizontal() ? s : "top"] = `${l}px`;
              });
            }
          }
          d.forEach((t, l) => {
            if (
              ("fraction" === r.type &&
                (t.querySelectorAll(n(r.currentClass)).forEach((t) => {
                  t.textContent = r.formatFractionCurrent(e + 1);
                }),
                t.querySelectorAll(n(r.totalClass)).forEach((e) => {
                  e.textContent = r.formatFractionTotal(h);
                })),
              "progressbar" === r.type)
            ) {
              let l;
              l = r.progressbarOpposite
                ? a.isHorizontal()
                  ? "vertical"
                  : "horizontal"
                : a.isHorizontal()
                  ? "horizontal"
                  : "vertical";
              let s = (e + 1) / h,
                i = 1,
                o = 1;
              ("horizontal" === l ? (i = s) : (o = s),
                t.querySelectorAll(n(r.progressbarFillClass)).forEach((e) => {
                  ((e.style.transform = `translate3d(0,0,0) scaleX(${i}) scaleY(${o})`),
                    (e.style.transitionDuration = `${a.params.speed}ms`));
                }));
            }
            ("custom" === r.type && r.renderCustom
              ? ((t.innerHTML = r.renderCustom(a, e + 1, h)), 0 === l && o("paginationRender", t))
              : (0 === l && o("paginationRender", t), o("paginationUpdate", t)),
              a.params.watchOverflow &&
                a.enabled &&
                t.classList[a.isLocked ? "add" : "remove"](r.lockClass));
          });
        }
        function g() {
          let e = a.params.pagination;
          if (c()) return;
          let t =
              a.virtual && a.params.virtual.enabled
                ? a.virtual.slides.length
                : a.grid && a.params.grid.rows > 1
                  ? a.slides.length / Math.ceil(a.params.grid.rows)
                  : a.slides.length,
            l = a.pagination.el;
          l = (0, s.m)(l);
          let i = "";
          if ("bullets" === e.type) {
            let l = a.params.loop ? Math.ceil(t / a.params.slidesPerGroup) : a.snapGrid.length;
            a.params.freeMode && a.params.freeMode.enabled && l > t && (l = t);
            for (let t = 0; t < l; t += 1)
              e.renderBullet
                ? (i += e.renderBullet.call(a, t, e.bulletClass))
                : (i += `<${e.bulletElement} ${a.isElement ? 'part="bullet"' : ""} class="${e.bulletClass}"></${e.bulletElement}>`);
          }
          ("fraction" === e.type &&
            (i = e.renderFraction
              ? e.renderFraction.call(a, e.currentClass, e.totalClass)
              : `<span class="${e.currentClass}"></span> / <span class="${e.totalClass}"></span>`),
            "progressbar" === e.type &&
              (i = e.renderProgressbar
                ? e.renderProgressbar.call(a, e.progressbarFillClass)
                : `<span class="${e.progressbarFillClass}"></span>`),
            (a.pagination.bullets = []),
            l.forEach((t) => {
              ("custom" !== e.type && (t.innerHTML = i || ""),
                "bullets" === e.type &&
                  a.pagination.bullets.push(...t.querySelectorAll(n(e.bulletClass))));
            }),
            "custom" !== e.type && o("paginationRender", l[0]));
        }
        function f() {
          let e;
          a.params.pagination = r(a, a.originalParams.pagination, a.params.pagination, {
            el: "swiper-pagination",
          });
          let t = a.params.pagination;
          t.el &&
            ("string" == typeof t.el && a.isElement && (e = a.el.querySelector(t.el)),
            e || "string" != typeof t.el || (e = [...document.querySelectorAll(t.el)]),
            e || (e = t.el),
            e &&
              0 !== e.length &&
              (a.params.uniqueNavElements &&
                "string" == typeof t.el &&
                Array.isArray(e) &&
                e.length > 1 &&
                (e = [...a.el.querySelectorAll(t.el)]).length > 1 &&
                (e = e.find((e) => (0, s.a)(e, ".swiper")[0] === a.el)),
              Array.isArray(e) && 1 === e.length && (e = e[0]),
              Object.assign(a.pagination, { el: e }),
              (e = (0, s.m)(e)).forEach((e) => {
                ("bullets" === t.type &&
                  t.clickable &&
                  e.classList.add(...(t.clickableClass || "").split(" ")),
                  e.classList.add(t.modifierClass + t.type),
                  e.classList.add(a.isHorizontal() ? t.horizontalClass : t.verticalClass),
                  "bullets" === t.type &&
                    t.dynamicBullets &&
                    (e.classList.add(`${t.modifierClass}${t.type}-dynamic`),
                    (p = 0),
                    t.dynamicMainBullets < 1 && (t.dynamicMainBullets = 1)),
                  "progressbar" === t.type &&
                    t.progressbarOpposite &&
                    e.classList.add(t.progressbarOppositeClass),
                  t.clickable && e.addEventListener("click", u),
                  a.enabled || e.classList.add(t.lockClass));
              })));
        }
        function b() {
          let e = a.params.pagination;
          if (c()) return;
          let t = a.pagination.el;
          (t &&
            (t = (0, s.m)(t)).forEach((t) => {
              (t.classList.remove(e.hiddenClass),
                t.classList.remove(e.modifierClass + e.type),
                t.classList.remove(a.isHorizontal() ? e.horizontalClass : e.verticalClass),
                e.clickable &&
                  (t.classList.remove(...(e.clickableClass || "").split(" ")),
                  t.removeEventListener("click", u)));
            }),
            a.pagination.bullets &&
              a.pagination.bullets.forEach((t) =>
                t.classList.remove(...e.bulletActiveClass.split(" "))
              ));
        }
        (i("changeDirection", () => {
          if (!a.pagination || !a.pagination.el) return;
          let e = a.params.pagination,
            { el: t } = a.pagination;
          (t = (0, s.m)(t)).forEach((t) => {
            (t.classList.remove(e.horizontalClass, e.verticalClass),
              t.classList.add(a.isHorizontal() ? e.horizontalClass : e.verticalClass));
          });
        }),
          i("init", () => {
            !1 === a.params.pagination.enabled ? v() : (f(), g(), h());
          }),
          i("activeIndexChange", () => {
            void 0 === a.snapIndex && h();
          }),
          i("snapIndexChange", () => {
            h();
          }),
          i("snapGridLengthChange", () => {
            (g(), h());
          }),
          i("destroy", () => {
            b();
          }),
          i("enable disable", () => {
            let { el: e } = a.pagination;
            e &&
              (e = (0, s.m)(e)).forEach((e) =>
                e.classList[a.enabled ? "remove" : "add"](a.params.pagination.lockClass)
              );
          }),
          i("lock unlock", () => {
            h();
          }),
          i("click", (e, t) => {
            let l = t.target,
              i = (0, s.m)(a.pagination.el);
            if (
              a.params.pagination.el &&
              a.params.pagination.hideOnClick &&
              i &&
              i.length > 0 &&
              !l.classList.contains(a.params.pagination.bulletClass)
            ) {
              if (
                a.navigation &&
                ((a.navigation.nextEl && l === a.navigation.nextEl) ||
                  (a.navigation.prevEl && l === a.navigation.prevEl))
              )
                return;
              (!0 === i[0].classList.contains(a.params.pagination.hiddenClass)
                ? o("paginationShow")
                : o("paginationHide"),
                i.forEach((e) => e.classList.toggle(a.params.pagination.hiddenClass)));
            }
          }));
        let v = () => {
          a.el.classList.add(a.params.pagination.paginationDisabledClass);
          let { el: e } = a.pagination;
          (e &&
            (e = (0, s.m)(e)).forEach((e) =>
              e.classList.add(a.params.pagination.paginationDisabledClass)
            ),
            b());
        };
        Object.assign(a.pagination, {
          enable: () => {
            a.el.classList.remove(a.params.pagination.paginationDisabledClass);
            let { el: e } = a.pagination;
            (e &&
              (e = (0, s.m)(e)).forEach((e) =>
                e.classList.remove(a.params.pagination.paginationDisabledClass)
              ),
              f(),
              g(),
              h());
          },
          disable: v,
          render: g,
          update: h,
          init: f,
          destroy: b,
        });
      }
      function d(e) {
        let t,
          a,
          i,
          o,
          { swiper: d, extendParams: p, on: c, emit: m } = e,
          u = (0, l.g)(),
          h = !1,
          g = null,
          f = null;
        function b() {
          if (!d.params.scrollbar.el || !d.scrollbar.el) return;
          let { scrollbar: e, rtlTranslate: t } = d,
            { dragEl: l, el: s } = e,
            r = d.params.scrollbar,
            n = d.params.loop ? d.progressLoop : d.progress,
            o = a,
            p = (i - a) * n;
          (t
            ? (p = -p) > 0
              ? ((o = a - p), (p = 0))
              : -p + a > i && (o = i + p)
            : p < 0
              ? ((o = a + p), (p = 0))
              : p + a > i && (o = i - p),
            d.isHorizontal()
              ? ((l.style.transform = `translate3d(${p}px, 0, 0)`), (l.style.width = `${o}px`))
              : ((l.style.transform = `translate3d(0px, ${p}px, 0)`), (l.style.height = `${o}px`)),
            r.hide &&
              (clearTimeout(g),
              (s.style.opacity = 1),
              (g = setTimeout(() => {
                ((s.style.opacity = 0), (s.style.transitionDuration = "400ms"));
              }, 1e3))));
        }
        function v() {
          if (!d.params.scrollbar.el || !d.scrollbar.el) return;
          let { scrollbar: e } = d,
            { dragEl: t, el: l } = e;
          ((t.style.width = ""),
            (t.style.height = ""),
            (i = d.isHorizontal() ? l.offsetWidth : l.offsetHeight),
            (o =
              d.size /
              (d.virtualSize +
                d.params.slidesOffsetBefore -
                (d.params.centeredSlides ? d.snapGrid[0] : 0))),
            (a =
              "auto" === d.params.scrollbar.dragSize
                ? i * o
                : parseInt(d.params.scrollbar.dragSize, 10)),
            d.isHorizontal() ? (t.style.width = `${a}px`) : (t.style.height = `${a}px`),
            o >= 1 ? (l.style.display = "none") : (l.style.display = ""),
            d.params.scrollbar.hide && (l.style.opacity = 0),
            d.params.watchOverflow &&
              d.enabled &&
              e.el.classList[d.isLocked ? "add" : "remove"](d.params.scrollbar.lockClass));
        }
        function y(e) {
          return d.isHorizontal() ? e.clientX : e.clientY;
        }
        function C(e) {
          let l,
            { scrollbar: r, rtlTranslate: n } = d,
            { el: o } = r;
          ((l = Math.max(
            Math.min(
              (l =
                (y(e) - (0, s.b)(o)[d.isHorizontal() ? "left" : "top"] - (null !== t ? t : a / 2)) /
                (i - a)),
              1
            ),
            0
          )),
            n && (l = 1 - l));
          let p = d.minTranslate() + (d.maxTranslate() - d.minTranslate()) * l;
          (d.updateProgress(p), d.setTranslate(p), d.updateActiveIndex(), d.updateSlidesClasses());
        }
        function w(e) {
          let a = d.params.scrollbar,
            { scrollbar: l, wrapperEl: s } = d,
            { el: i, dragEl: r } = l;
          ((h = !0),
            (t =
              e.target === r
                ? y(e) - e.target.getBoundingClientRect()[d.isHorizontal() ? "left" : "top"]
                : null),
            e.preventDefault(),
            e.stopPropagation(),
            (s.style.transitionDuration = "100ms"),
            (r.style.transitionDuration = "100ms"),
            C(e),
            clearTimeout(f),
            (i.style.transitionDuration = "0ms"),
            a.hide && (i.style.opacity = 1),
            d.params.cssMode && (d.wrapperEl.style["scroll-snap-type"] = "none"),
            m("scrollbarDragStart", e));
        }
        function x(e) {
          let { scrollbar: t, wrapperEl: a } = d,
            { el: l, dragEl: s } = t;
          h &&
            (e.preventDefault && e.cancelable ? e.preventDefault() : (e.returnValue = !1),
            C(e),
            (a.style.transitionDuration = "0ms"),
            (l.style.transitionDuration = "0ms"),
            (s.style.transitionDuration = "0ms"),
            m("scrollbarDragMove", e));
        }
        function E(e) {
          let t = d.params.scrollbar,
            { scrollbar: a, wrapperEl: l } = d,
            { el: i } = a;
          h &&
            ((h = !1),
            d.params.cssMode &&
              ((d.wrapperEl.style["scroll-snap-type"] = ""), (l.style.transitionDuration = "")),
            t.hide &&
              (clearTimeout(f),
              (f = (0, s.n)(() => {
                ((i.style.opacity = 0), (i.style.transitionDuration = "400ms"));
              }, 1e3))),
            m("scrollbarDragEnd", e),
            t.snapOnRelease && d.slideToClosest());
        }
        function M(e) {
          let { scrollbar: t, params: a } = d,
            l = t.el;
          if (!l) return;
          let s = !!a.passiveListeners && { passive: !1, capture: !1 },
            i = !!a.passiveListeners && { passive: !0, capture: !1 };
          if (!l) return;
          let r = "on" === e ? "addEventListener" : "removeEventListener";
          (l[r]("pointerdown", w, s), u[r]("pointermove", x, s), u[r]("pointerup", E, i));
        }
        function T() {
          let e,
            t,
            { scrollbar: a, el: l } = d;
          d.params.scrollbar = r(d, d.originalParams.scrollbar, d.params.scrollbar, {
            el: "swiper-scrollbar",
          });
          let i = d.params.scrollbar;
          if (i.el) {
            if (
              ("string" == typeof i.el && d.isElement && (e = d.el.querySelector(i.el)),
              e || "string" != typeof i.el)
            )
              e || (e = i.el);
            else if (!(e = u.querySelectorAll(i.el)).length) return;
            (d.params.uniqueNavElements &&
              "string" == typeof i.el &&
              e.length > 1 &&
              1 === l.querySelectorAll(i.el).length &&
              (e = l.querySelector(i.el)),
              e.length > 0 && (e = e[0]),
              e.classList.add(d.isHorizontal() ? i.horizontalClass : i.verticalClass),
              e &&
                ((t = e.querySelector(n(d.params.scrollbar.dragClass))) ||
                  ((t = (0, s.c)("div", d.params.scrollbar.dragClass)), e.append(t))),
              Object.assign(a, { el: e, dragEl: t }),
              i.draggable && d.params.scrollbar.el && d.scrollbar.el && M("on"),
              e &&
                e.classList[d.enabled ? "remove" : "add"](
                  ...(0, s.i)(d.params.scrollbar.lockClass)
                ));
          }
        }
        function S() {
          let e = d.params.scrollbar,
            t = d.scrollbar.el;
          (t &&
            t.classList.remove(...(0, s.i)(d.isHorizontal() ? e.horizontalClass : e.verticalClass)),
            d.params.scrollbar.el && d.scrollbar.el && M("off"));
        }
        (p({
          scrollbar: {
            el: null,
            dragSize: "auto",
            hide: !1,
            draggable: !1,
            snapOnRelease: !0,
            lockClass: "swiper-scrollbar-lock",
            dragClass: "swiper-scrollbar-drag",
            scrollbarDisabledClass: "swiper-scrollbar-disabled",
            horizontalClass: "swiper-scrollbar-horizontal",
            verticalClass: "swiper-scrollbar-vertical",
          },
        }),
          (d.scrollbar = { el: null, dragEl: null }),
          c("changeDirection", () => {
            if (!d.scrollbar || !d.scrollbar.el) return;
            let e = d.params.scrollbar,
              { el: t } = d.scrollbar;
            (t = (0, s.m)(t)).forEach((t) => {
              (t.classList.remove(e.horizontalClass, e.verticalClass),
                t.classList.add(d.isHorizontal() ? e.horizontalClass : e.verticalClass));
            });
          }),
          c("init", () => {
            !1 === d.params.scrollbar.enabled ? L() : (T(), v(), b());
          }),
          c("update resize observerUpdate lock unlock changeDirection", () => {
            v();
          }),
          c("setTranslate", () => {
            b();
          }),
          c("setTransition", (e, t) => {
            d.params.scrollbar.el &&
              d.scrollbar.el &&
              (d.scrollbar.dragEl.style.transitionDuration = `${t}ms`);
          }),
          c("enable disable", () => {
            let { el: e } = d.scrollbar;
            e &&
              e.classList[d.enabled ? "remove" : "add"](...(0, s.i)(d.params.scrollbar.lockClass));
          }),
          c("destroy", () => {
            S();
          }));
        let L = () => {
          (d.el.classList.add(...(0, s.i)(d.params.scrollbar.scrollbarDisabledClass)),
            d.scrollbar.el &&
              d.scrollbar.el.classList.add(...(0, s.i)(d.params.scrollbar.scrollbarDisabledClass)),
            S());
        };
        Object.assign(d.scrollbar, {
          enable: () => {
            (d.el.classList.remove(...(0, s.i)(d.params.scrollbar.scrollbarDisabledClass)),
              d.scrollbar.el &&
                d.scrollbar.el.classList.remove(
                  ...(0, s.i)(d.params.scrollbar.scrollbarDisabledClass)
                ),
              T(),
              v(),
              b());
          },
          disable: L,
          updateSize: v,
          setTranslate: b,
          init: T,
          destroy: S,
        });
      }
      function p(e) {
        let { swiper: t, extendParams: a, emit: l, once: i } = e;
        (a({
          freeMode: {
            enabled: !1,
            momentum: !0,
            momentumRatio: 1,
            momentumBounce: !0,
            momentumBounceRatio: 1,
            momentumVelocityRatio: 1,
            sticky: !1,
            minimumVelocity: 0.02,
          },
        }),
          Object.assign(t, {
            freeMode: {
              onTouchStart: function () {
                if (t.params.cssMode) return;
                let e = t.getTranslate();
                (t.setTranslate(e),
                  t.setTransition(0),
                  (t.touchEventsData.velocities.length = 0),
                  t.freeMode.onTouchEnd({ currentPos: t.rtl ? t.translate : -t.translate }));
              },
              onTouchMove: function () {
                if (t.params.cssMode) return;
                let { touchEventsData: e, touches: a } = t;
                (0 === e.velocities.length &&
                  e.velocities.push({
                    position: a[t.isHorizontal() ? "startX" : "startY"],
                    time: e.touchStartTime,
                  }),
                  e.velocities.push({
                    position: a[t.isHorizontal() ? "currentX" : "currentY"],
                    time: (0, s.d)(),
                  }));
              },
              onTouchEnd: function (e) {
                let { currentPos: a } = e;
                if (t.params.cssMode) return;
                let {
                    params: r,
                    wrapperEl: n,
                    rtlTranslate: o,
                    snapGrid: d,
                    touchEventsData: p,
                  } = t,
                  c = (0, s.d)() - p.touchStartTime;
                if (a < -t.minTranslate()) return void t.slideTo(t.activeIndex);
                if (a > -t.maxTranslate())
                  return void (t.slides.length < d.length
                    ? t.slideTo(d.length - 1)
                    : t.slideTo(t.slides.length - 1));
                if (r.freeMode.momentum) {
                  let e, a;
                  if (p.velocities.length > 1) {
                    let e = p.velocities.pop(),
                      a = p.velocities.pop(),
                      l = e.position - a.position,
                      i = e.time - a.time;
                    ((t.velocity = l / i),
                      (t.velocity /= 2),
                      Math.abs(t.velocity) < r.freeMode.minimumVelocity && (t.velocity = 0),
                      (i > 150 || (0, s.d)() - e.time > 300) && (t.velocity = 0));
                  } else t.velocity = 0;
                  ((t.velocity *= r.freeMode.momentumVelocityRatio), (p.velocities.length = 0));
                  let c = 1e3 * r.freeMode.momentumRatio,
                    m = t.velocity * c,
                    u = t.translate + m;
                  o && (u = -u);
                  let h = !1,
                    g = 20 * Math.abs(t.velocity) * r.freeMode.momentumBounceRatio;
                  if (u < t.maxTranslate())
                    (r.freeMode.momentumBounce
                      ? (u + t.maxTranslate() < -g && (u = t.maxTranslate() - g),
                        (e = t.maxTranslate()),
                        (h = !0),
                        (p.allowMomentumBounce = !0))
                      : (u = t.maxTranslate()),
                      r.loop && r.centeredSlides && (a = !0));
                  else if (u > t.minTranslate())
                    (r.freeMode.momentumBounce
                      ? (u - t.minTranslate() > g && (u = t.minTranslate() + g),
                        (e = t.minTranslate()),
                        (h = !0),
                        (p.allowMomentumBounce = !0))
                      : (u = t.minTranslate()),
                      r.loop && r.centeredSlides && (a = !0));
                  else if (r.freeMode.sticky) {
                    let e;
                    for (let t = 0; t < d.length; t += 1)
                      if (d[t] > -u) {
                        e = t;
                        break;
                      }
                    u = -(u =
                      Math.abs(d[e] - u) < Math.abs(d[e - 1] - u) || "next" === t.swipeDirection
                        ? d[e]
                        : d[e - 1]);
                  }
                  if (
                    (a &&
                      i("transitionEnd", () => {
                        t.loopFix();
                      }),
                    0 !== t.velocity)
                  ) {
                    if (
                      ((c = o
                        ? Math.abs((-u - t.translate) / t.velocity)
                        : Math.abs((u - t.translate) / t.velocity)),
                      r.freeMode.sticky)
                    ) {
                      let e = Math.abs((o ? -u : u) - t.translate),
                        a = t.slidesSizesGrid[t.activeIndex];
                      c = e < a ? r.speed : e < 2 * a ? 1.5 * r.speed : 2.5 * r.speed;
                    }
                  } else if (r.freeMode.sticky) return void t.slideToClosest();
                  (r.freeMode.momentumBounce && h
                    ? (t.updateProgress(e),
                      t.setTransition(c),
                      t.setTranslate(u),
                      t.transitionStart(!0, t.swipeDirection),
                      (t.animating = !0),
                      (0, s.k)(n, () => {
                        t &&
                          !t.destroyed &&
                          p.allowMomentumBounce &&
                          (l("momentumBounce"),
                          t.setTransition(r.speed),
                          setTimeout(() => {
                            (t.setTranslate(e),
                              (0, s.k)(n, () => {
                                t && !t.destroyed && t.transitionEnd();
                              }));
                          }, 0));
                      }))
                    : t.velocity
                      ? (l("_freeModeNoMomentumRelease"),
                        t.updateProgress(u),
                        t.setTransition(c),
                        t.setTranslate(u),
                        t.transitionStart(!0, t.swipeDirection),
                        t.animating ||
                          ((t.animating = !0),
                          (0, s.k)(n, () => {
                            t && !t.destroyed && t.transitionEnd();
                          })))
                      : t.updateProgress(u),
                    t.updateActiveIndex(),
                    t.updateSlidesClasses());
                } else {
                  if (r.freeMode.sticky) return void t.slideToClosest();
                  r.freeMode && l("_freeModeNoMomentumRelease");
                }
                (!r.freeMode.momentum || c >= r.longSwipesMs) &&
                  (l("_freeModeStaticRelease"),
                  t.updateProgress(),
                  t.updateActiveIndex(),
                  t.updateSlidesClasses());
              },
            },
          }));
      }
      function c(e) {
        let t,
          a,
          l,
          s,
          { swiper: i, extendParams: r, on: n } = e;
        r({ grid: { rows: 1, fill: "column" } });
        let o = () => {
          let e = i.params.spaceBetween;
          return (
            "string" == typeof e && e.indexOf("%") >= 0
              ? (e = (parseFloat(e.replace("%", "")) / 100) * i.size)
              : "string" == typeof e && (e = parseFloat(e)),
            e
          );
        };
        (n("init", () => {
          s = i.params.grid && i.params.grid.rows > 1;
        }),
          n("update", () => {
            let { params: e, el: t } = i,
              a = e.grid && e.grid.rows > 1;
            (s && !a
              ? (t.classList.remove(
                  `${e.containerModifierClass}grid`,
                  `${e.containerModifierClass}grid-column`
                ),
                (l = 1),
                i.emitContainerClasses())
              : !s &&
                a &&
                (t.classList.add(`${e.containerModifierClass}grid`),
                "column" === e.grid.fill &&
                  t.classList.add(`${e.containerModifierClass}grid-column`),
                i.emitContainerClasses()),
              (s = a));
          }),
          (i.grid = {
            initSlides: (e) => {
              let { slidesPerView: s } = i.params,
                { rows: r, fill: n } = i.params.grid,
                o = i.virtual && i.params.virtual.enabled ? i.virtual.slides.length : e.length;
              ((l = Math.floor(o / r)),
                (t = Math.floor(o / r) === o / r ? o : Math.ceil(o / r) * r),
                "auto" !== s && "row" === n && (t = Math.max(t, s * r)),
                (a = t / r));
            },
            unsetSlides: () => {
              i.slides &&
                i.slides.forEach((e) => {
                  e.swiperSlideGridSet &&
                    ((e.style.height = ""), (e.style[i.getDirectionLabel("margin-top")] = ""));
                });
            },
            updateSlide: (e, s, r) => {
              let n,
                d,
                p,
                { slidesPerGroup: c } = i.params,
                m = o(),
                { rows: u, fill: h } = i.params.grid,
                g = i.virtual && i.params.virtual.enabled ? i.virtual.slides.length : r.length;
              if ("row" === h && c > 1) {
                let a = Math.floor(e / (c * u)),
                  l = e - u * c * a,
                  i = 0 === a ? c : Math.min(Math.ceil((g - a * u * c) / u), c);
                ((p = Math.floor(l / i)),
                  (n = (d = l - p * i + a * c) + (p * t) / u),
                  (s.style.order = n));
              } else
                "column" === h
                  ? ((d = Math.floor(e / u)),
                    (p = e - d * u),
                    (d > l || (d === l && p === u - 1)) && (p += 1) >= u && ((p = 0), (d += 1)))
                  : ((p = Math.floor(e / a)), (d = e - p * a));
              ((s.row = p),
                (s.column = d),
                (s.style.height = `calc((100% - ${(u - 1) * m}px) / ${u})`),
                (s.style[i.getDirectionLabel("margin-top")] = 0 !== p ? m && `${m}px` : ""),
                (s.swiperSlideGridSet = !0));
            },
            updateWrapperSize: (e, a) => {
              let { centeredSlides: l, roundLengths: s } = i.params,
                r = o(),
                { rows: n } = i.params.grid;
              if (
                ((i.virtualSize = (e + r) * t),
                (i.virtualSize = Math.ceil(i.virtualSize / n) - r),
                i.params.cssMode ||
                  (i.wrapperEl.style[i.getDirectionLabel("width")] = `${i.virtualSize + r}px`),
                l)
              ) {
                let e = [];
                for (let t = 0; t < a.length; t += 1) {
                  let l = a[t];
                  (s && (l = Math.floor(l)), a[t] < i.virtualSize + a[0] && e.push(l));
                }
                (a.splice(0, a.length), a.push(...e));
              }
            },
          }));
      }
    },
  },
]);
