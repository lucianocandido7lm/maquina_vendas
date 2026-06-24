(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [3889],
  {
    11324: (e, t, r) => {
      "use strict";
      r.d(t, { Footer: () => B });
      var a = r(95155),
        n = r(86098),
        o = r(46421),
        i = r.n(o),
        l = r(34804),
        s = r(93820),
        d = r(39957),
        c = r(47605),
        u = r(26039),
        h = r(12115),
        m = r(52619),
        p = r.n(m),
        g = r(22544),
        _ = r(66942),
        f = r(15653),
        w = r(17220),
        b = r(28771),
        y = r(64206),
        v = r(32048),
        k = r(44517),
        S = r(2821);
      let C = f.z.object({ email: f.z.string().email("Por favor, insira um endereço de e-mail válido") }),
        H = () => {
          let [e, t] = (0, h.useState)(!1),
            { fetchReCaptchaToken: r } = (0, v.A)(),
            n = (0, g.mN)({
              resolver: (0, _.u)(C),
              defaultValues: { email: "" },
              mode: "onSubmit",
              reValidateMode: "onSubmit",
            }),
            o = async (e) => {
              t(!0);
              try {
                let t = await r();
                if (!t)
                  return void k.Ay.error(
                    "Unable to verify you're human. Please refresh the page and try again."
                  );
                let a = window.location.pathname.split("/")[1] || "";
                (await y.B.post("/prod/v1/website-inquiry", {
                  captcha_token: t,
                  source_form: "newsletter",
                  email: e.email,
                  page: a,
                  section: "footer",
                  element_id: "btn_newsletter_signup_footer",
                }),
                  n.reset(),
                  k.Ay.success("Inscrição na nossa newsletter realizada com sucesso!"));
              } catch (e) {
                (console.error("Newsletter subscription error:", e),
                  k.Ay.error("Algo deu errado. Tente novamente mais tarde."));
              } finally {
                t(!1);
              }
            };
          return (0, a.jsx)("div", {
            className: (0, S.A)(
              i()["newsletter-form"],
              n.formState.errors.email && i()["newsletter-form-error"]
            ),
            children: (0, a.jsx)(g.Op, {
              ...n,
              children: (0, a.jsx)("form", {
                onSubmit: n.handleSubmit(o),
                children: (0, a.jsx)(g.xI, {
                  name: "email",
                  disabled: e,
                  render: (t) => {
                    let { field: r, fieldState: o } = t;
                    return (0, a.jsxs)("div", {
                      className: i()["input-container"],
                      children: [
                        (0, a.jsx)(w.G, {
                          ...r,
                          onChange: (e) => {
                            (r.onChange(e), n.clearErrors("email"));
                          },
                          placeholder: "Digite seu e-mail",
                          theme: "dark",
                          inputClassName: i().input,
                          inputWrapperClassName: i()["input-wrapper"],
                          errorMessage: o.error?.message,
                        }),
                        (0, a.jsx)("button", {
                          id: "btn_newsletter_signup_footer",
                          type: "submit",
                          className: i()["newsletter-submit-btn"],
                          disabled: e,
                          children: (0, a.jsx)(b.h, {}),
                        }),
                      ],
                    });
                  },
                }),
              }),
            }),
          });
        };
      var N = r(78064);
      let x = [
          { label: "Buscar", href: s.a.search },
          { label: "Agentes", href: s.a.agents },
          { label: "Faça Parte", href: s.a.join },
          { label: "Sobre Nós", href: s.a.about },
          { label: "Portal do Agente", href: s.a.signInAgentPortal },
        ],
        P = [
          { label: "Termos", href: s.a.terms },
          { label: "Política de Privacidade", href: s.a.privacy },
          { label: "Aviso de Habitação Justa", href: s.a.fairHousingNotice, target: "_blank" },
          { label: "Procedimento Operacional", href: s.a.operatingProcedure },
          { label: "Imprensa", href: s.a.press },
          { label: "Aceitamos vouchers de escolha de moradia" },
          { label: "Se Aceptan Vales de Elecci\xf3n de Vivienda" },
        ],
        M = [
          { label: "Facebook", href: N.V$.facebook },
          { label: "Instagram", href: N.V$.instagram },
          { label: "Youtube", href: N.V$.youtube },
          { label: "Linkedin", href: N.V$.linkedin },
        ],
        B = () => {
          let e = (0, h.useRef)(null),
            t = (0, h.useRef)(null),
            r = (0, h.useRef)(null);
          return (
            (0, d.L)(
              () => {
                (c.Ay.matchMedia().add("(min-width: 768px)", () => {
                  t.current &&
                    e.current &&
                    (0, u.Tv)(
                      t.current,
                      e.current,
                      {
                        fromY: "-40%",
                        toY: "0%",
                        fromScale: 0.98,
                        opacityDuration: 0.3,
                        scaleDuration: 0.4,
                        ease: "power1.out",
                      },
                      { trigger: e.current, scrub: !0, start: "top bottom", end: "bottom bottom" }
                    );
                }),
                  r.current &&
                    (0, u.WN)(r.current.querySelectorAll("path"), {
                      fromY: 20,
                      opacityDuration: 1,
                      stagger: { each: 0.1, from: "end" },
                    }));
              },
              { scope: e }
            ),
            (0, a.jsx)("div", {
              ref: e,
              className: i().wrapper,
              children: (0, a.jsx)(n.m, {
                children: (0, a.jsxs)("div", {
                  ref: t,
                  className: i().content,
                  children: [
                    (0, a.jsxs)("div", {
                      className: i()["newsletter-container"],
                      children: [
                        (0, a.jsxs)("div", {
                          className: i().newsletter,
                          children: [
                            (0, a.jsx)("div", {
                              className: i()["newsletter-title"],
                              children: "Assine a nossa newsletter!",
                            }),
                            (0, a.jsx)(H, {}),
                          ],
                        }),
                        (0, a.jsxs)("div", {
                          className: i().contacts,
                          children: [
                            (0, a.jsxs)("div", {
                              "data-contact": "address",
                              className: i().contact,
                              children: [
                                (0, a.jsx)("div", {
                                  className: i()["contact-label"],
                                  children: "FORMOSA",
                                }),
                                (0, a.jsx)("div", {
                                  className: i()["contact-value"],
                                  children: (0, a.jsxs)("a", {
                                    href: "https://maps.google.com/?q=RUA%20EM%C3%8DLIO%20P%C3%93VOA%2C%20R.L%20TREZE%2C%20N%C2%B0%2013%2C%20QUADRA%2018%2C%20CENTRO%2C%20FORMOSA%20-%20GO%2C%2073801-280",
                                    children: [
                                      (0, a.jsx)("div", {
                                        children: "RUA EMÍLIO PÓVOA, R.L TREZE, N° 13, QUADRA 18.",
                                      }),
                                      (0, a.jsx)("div", { children: "CENTRO, FORMOSA - GO." }),
                                      (0, a.jsx)("div", { children: "73801-280" }),
                                    ],
                                  }),
                                }),
                              ],
                            }),
                            (0, a.jsxs)("div", {
                              "data-contact": "email",
                              className: i().contact,
                              children: [
                                (0, a.jsx)("div", {
                                  className: i()["contact-label"],
                                  children: "Envie um e-mail",
                                }),
                                (0, a.jsx)("div", {
                                  className: i()["contact-value"],
                                  children: (0, a.jsx)("a", {
                                    href: "mailto:sucessodocliente@7lm.com.br",
                                    children: "sucessodocliente@7lm.com.br",
                                  }),
                                }),
                              ],
                            }),
                            (0, a.jsxs)("div", {
                              "data-contact": "phone",
                              className: i().contact,
                              children: [
                                (0, a.jsx)("div", {
                                  className: i()["contact-label"],
                                  children: "Ligue para nós",
                                }),
                                (0, a.jsx)("div", {
                                  className: i()["contact-value"],
                                  children: (0, a.jsx)("a", {
                                    href: "tel:+556132466180",
                                    children: (0, a.jsx)("span", { children: "(61) 3246-6180" }),
                                  }),
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                    null,
                    null,
                    (0, a.jsxs)("div", {
                      className: i()["copyright-container"],
                      children: [
                        null,
                        null,
                        (0, a.jsxs)("div", {
                          className: i().copyright,
                          children: ["Copyright \xa9 ", new Date().getFullYear()],
                        }),
                      ],
                    }),
                    null,
                  ],
                }),
              }),
            })
          );
        };
    },
    23231: (e) => {
      e.exports = {
        em: "header_em__dSCBv",
        invisible: "header_invisible__KGxmL",
        "desktop-only": "header_desktop-only__5MeU6",
        "mobile-only": "header_mobile-only__JiTEl",
        underline: "header_underline__O0knD",
        "dropdown-item": "header_dropdown-item__iQvkg",
        "dropdown-content": "header_dropdown-content__yQbNW",
        "dropdown-trigger": "header_dropdown-trigger__Feuo0",
        underlined: "header_underlined__zAAP3",
        outlined: "header_outlined__m1V8w",
        wrapper: "header_wrapper__MJ5bn",
        content: "header_content__cVJDb",
        dark: "header_dark__4CZ9W",
        "burger-control": "header_burger-control__YR_x_",
        "-opened": "header_-opened__CJ24_",
        transparent: "header_transparent__rCyyn",
        "-fixed": "header_-fixed__r0usw",
        "-hidden": "header_-hidden__CVUoR",
        logo: "header_logo__LO_Jk",
        nav: "header_nav__if_jI",
        "nav-item": "header_nav-item__Wn05d",
        "nav-arrow": "header_nav-arrow__c0sU_",
        "-rotated": "header_-rotated__ja72k",
        actions: "header_actions__Sv09J",
      };
    },
    26039: (e, t, r) => {
      "use strict";
      r.d(t, {
        P5: () => u,
        T6: () => h,
        Tv: () => v,
        WN: () => m,
        bA: () => S,
        fP: () => g,
        gr: () => k,
        i1: () => f,
        qN: () => b,
        yw: () => d,
        z4: () => s,
      });
      var a = r(47605),
        n = r(44151),
        o = r(55580),
        i = r(71207),
        l = r(60211);
      a.os.registerPlugin(o.u, n.A, i.M);
      let s = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
            r = { duration: 2, delay: 0, ease: "power4.out", ...t },
            o = a.os.timeline(),
            i = new n.A(e, { type: "words" }),
            l = new n.A(i.words, { type: "words" });
          return (
            a.os.set(i.words, {
              overflow: "hidden",
              verticalAlign: "top",
              padding: "0.15em",
              margin: "-0.15em",
            }),
            a.os.set(l.words, { y: "120%" }),
            o.set(l.words, { willChange: "transform" }, 0),
            o.fromTo(
              l.words,
              { y: "115%" },
              {
                y: "0%",
                duration: r.duration,
                stagger: i.words.length > 5 ? { amount: 0.4 } : 0.1,
                delay: r.delay,
                ease: r.ease,
              },
              0
            ),
            o.set(l.words, { willChange: "auto" }),
            o
          );
        },
        d = (e) => o.u.create({ trigger: e, animation: s(e), once: !0 }),
        c = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
            r = {
              from: "inset(0 100% 0 0)",
              to: "inset(0 0% 0 0)",
              duration: 2,
              stagger: { amount: 0.15 },
              ease: "power3.out",
              clearProps: "clipPath",
              ...t,
            },
            n = a.os.timeline();
          return (
            n.fromTo(
              e,
              { clipPath: r.from },
              {
                clipPath: r.to,
                duration: r.duration,
                stagger: r.stagger,
                ease: r.ease,
                clearProps: r.clearProps,
              }
            ),
            n
          );
        },
        u = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
          return o.u.create({ trigger: e, animation: c(e, t), once: !0 });
        },
        h = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
            r = {
              fromY: 70,
              toY: 0,
              fromX: 0,
              toX: 0,
              duration: 2,
              opacityDuration: 0.1,
              stagger: 0.1,
              ease: "expo.out",
              ...t,
            },
            n = a.os.timeline();
          return (
            a.os.set(e, { opacity: 0 }),
            n.set(e, { willChange: "transform" }),
            n.fromTo(
              e,
              { opacity: 0 },
              { opacity: 1, duration: r.opacityDuration, stagger: r.stagger },
              0
            ),
            n.fromTo(
              e,
              { y: r.fromY, x: r.fromX },
              { y: r.toY, x: r.toX, duration: r.duration, stagger: r.stagger, ease: r.ease },
              0
            ),
            n.set(e, { willChange: "auto" }),
            n
          );
        },
        m = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
          return o.u.create({ trigger: e, animation: h(e, t), once: !0 });
        },
        p = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
            r = {
              fromX: 70,
              toX: 0,
              fromY: 0,
              toY: 0,
              duration: 2,
              opacityDuration: 0.1,
              stagger: 0.1,
              ease: "expo.out",
              ...t,
            },
            n = a.os.timeline();
          return (
            a.os.set(e, { opacity: 0, visibility: "visible" }),
            n.set(e, { willChange: "transform" }),
            n.fromTo(
              e,
              { opacity: 0 },
              { opacity: 1, duration: r.opacityDuration, stagger: r.stagger },
              0
            ),
            n.fromTo(
              e,
              { y: r.fromY, x: r.fromX, opacity: 0 },
              {
                y: r.toY,
                x: r.toX,
                opacity: 1,
                duration: r.duration,
                stagger: r.stagger,
                ease: r.ease,
              },
              0
            ),
            n.set(e, { willChange: "auto" }),
            n
          );
        },
        g = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
          return o.u.create({ trigger: e, animation: p(e, t), once: !0 });
        },
        _ = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
            r = { color: "rgba(255,255,255,0.8)", style: {}, origin: "right center", ...t },
            o = a.os.timeline(),
            i = new n.A(e, { type: "lines" }),
            l = [];
          return (
            i.lines.forEach((e) => {
              let t = document.createElement("div");
              (a.os.set(e, { width: "fit-content" }),
                a.os.set(t, {
                  position: "absolute",
                  top: "10%",
                  right: "-1%",
                  left: 0,
                  bottom: "-10%",
                  zIndex: 1,
                  opacity: 0.9,
                  background: r.color,
                  ...r.style,
                }),
                e.appendChild(t),
                l.push(t));
            }),
            o.to(
              l,
              {
                transform: "scaleX(0)",
                transformOrigin: r.origin,
                duration: 2,
                stagger: { amount: 0.15 },
                ease: "power3.out",
              },
              0
            ),
            o
          );
        },
        f = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
          return o.u.create({
            trigger: e,
            animation: _(e, t),
            start: "top bottom-=200px",
            end: "center center",
          });
        },
        w = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
            r = { from: 0, ...t },
            n = a.os.timeline(),
            o = { i: 0 },
            i = e.innerText.split(".")?.[1]?.length;
          return (
            n.fromTo(
              o,
              { i: r.from },
              {
                i: e.innerText,
                duration: 1.5,
                ease: e.innerText.length < 3 || i ? "power2.inOut" : "expo.out",
                onUpdate: () => {
                  i ? (e.innerText = o.i.toFixed(i)) : (e.innerText = (0, l.ZV)(o.i));
                },
              }
            ),
            n
          );
        },
        b = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
          return o.u.create({ trigger: e, animation: w(e, t), once: !0 });
        },
        y = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
            r = {
              fromY: "10%",
              toY: "-10%",
              fromScale: 1,
              toScale: 1,
              opacityDuration: 0,
              scaleDuration: 1,
              transformOrigin: "center",
              ease: "none",
              ...t,
            },
            n = a.os.timeline();
          return (
            n.set(e, { willChange: "transform" }),
            r.opacityDuration &&
              n.fromTo(
                e,
                { opacity: 0 },
                { opacity: 1, duration: r.opacityDuration, ease: r.ease },
                0
              ),
            r.fromScale !== r.toScale &&
              r.scaleDuration &&
              n.fromTo(
                e,
                { scale: r.fromScale },
                { scale: r.toScale, duration: r.scaleDuration, ease: r.ease },
                0
              ),
            n.fromTo(e, { y: r.fromY }, { y: r.toY, duration: 1, ease: r.ease }, 0),
            n.set(e, { willChange: "auto" }),
            n
          );
        },
        v = function (e, t) {
          let r = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {},
            a = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : {};
          return o.u.create({
            trigger: t,
            animation: y(e, r),
            start: "top bottom",
            end: "bottom top",
            scrub: 1.5,
            ...a,
          });
        },
        k = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
            r = { from: 0, to: 1, duration: 1, stagger: 0.1, delay: 0, ...t },
            n = a.os.timeline();
          return (
            a.os.set(e, { opacity: 0 }),
            n.fromTo(
              e,
              { opacity: r.from },
              { opacity: r.to, duration: r.duration, stagger: r.stagger },
              0
            ),
            n
          );
        },
        S = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
          return o.u.create({ trigger: e, animation: k(e, t), once: !0 });
        };
    },
    34804: (e, t, r) => {
      "use strict";
      r.d(t, { h: () => d });
      var a,
        n,
        o,
        i,
        l = r(12115);
      function s() {
        return (s = Object.assign
          ? Object.assign.bind()
          : function (e) {
              for (var t = 1; t < arguments.length; t++) {
                var r = arguments[t];
                for (var a in r) ({}).hasOwnProperty.call(r, a) && (e[a] = r[a]);
              }
              return e;
            }).apply(null, arguments);
      }
      let d = (e) =>
        l.createElement(
          "svg",
          s({ xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 975 280" }, e),
          a ||
            (a = l.createElement("path", {
              fill: "currentColor",
              d: "M836.06 1.01c77.3 0 139.94 62.69 139.94 140C976 218.33 913.35 281 836.06 281H702.61V1.01zm-52.82 80.17v119.44h44.58a59.5 59.5 0 0 0 42.21-17.5 59.7 59.7 0 0 0-42.2-101.94z",
              "data-letter": "f",
            })),
          n ||
            (n = l.createElement("path", {
              fill: "currentColor",
              d: "M595.45 183.2V1h80.14v279.99H556.68l-73.33-152.93V281H403.2V1h110.33z",
              "data-letter": "i",
            })),
          o ||
            (o = l.createElement("path", {
              fill: "currentColor",
              d: "M376.19 280.99h-141l61.26-140.29L235.2 1h141v279.99Z",
              "data-letter": "n",
            })),
          i ||
            (i = l.createElement("path", {
              fill: "currentColor",
              d: "M244.55 81.28H81.14v59.42h101.02v80.17H81.14v60.12H1V1h207.91z",
              "data-letter": "d",
            }))
        );
    },
    46421: (e) => {
      e.exports = {
        em: "footer_em__AsSFX",
        invisible: "footer_invisible__Tj_S6",
        "desktop-only": "footer_desktop-only__MXVZr",
        "mobile-only": "footer_mobile-only__uO3_O",
        underline: "footer_underline__zYjzn",
        "dropdown-item": "footer_dropdown-item__ziGzT",
        "dropdown-content": "footer_dropdown-content__ghD_E",
        "dropdown-trigger": "footer_dropdown-trigger__975_t",
        underlined: "footer_underlined__20Mv3",
        outlined: "footer_outlined__vebkW",
        content: "footer_content__E2ijt",
        wrapper: "footer_wrapper__9GQwi",
        "newsletter-container": "footer_newsletter-container__POI_T",
        "newsletter-title": "footer_newsletter-title__bRCRZ",
        "newsletter-form": "footer_newsletter-form__0k_h5",
        "newsletter-form-error": "footer_newsletter-form-error__8ZZA7",
        contacts: "footer_contacts__HFiAl",
        contact: "footer_contact__fFxbr",
        "contact-value": "footer_contact-value__e1jbK",
        "contact-label": "footer_contact-label__gYKsP",
        "nav-link": "footer_nav-link__LFUNG",
        "social-link": "footer_social-link__2uQBq",
        links: "footer_links__vib46",
        nav: "footer_nav__XkBHY",
        socials: "footer_socials__4JfcA",
        logo: "footer_logo__5ncK8",
        "copyright-container": "footer_copyright-container__yt1ht",
        sublinks: "footer_sublinks__Pj_ed",
        "input-container": "footer_input-container__K2c_A",
        "input-wrapper": "footer_input-wrapper__1l5CZ",
        "newsletter-submit-btn": "footer_newsletter-submit-btn__HrC3v",
      };
    },
    48314: (e, t, r) => {
      "use strict";
      r.d(t, { Header: () => E });
      var a = r(95155),
        n = r(86098),
        o = r(23231),
        i = r.n(o),
        l = r(34804),
        s = r(65169),
        d = r(12115),
        c = r(93820),
        u = r(52619),
        h = r.n(u),
        m = r(20063),
        p = r(2821),
        g = r(56348),
        _ = r(81591),
        f = r.n(_);
      let w = (e) => {
        let { children: t, items: r } = e,
          n = (0, m.useRouter)(),
          [o, i] = (0, d.useState)(!1);
        return (0, a.jsx)("div", {
          onMouseEnter: () => {
            i(!0);
          },
          onMouseLeave: () => {
            i(!1);
          },
          children: (0, a.jsxs)(g.Root, {
            open: o,
            onOpenChange: i,
            modal: !1,
            children: [
              (0, a.jsx)(g.Trigger, { asChild: !0, children: t(o) }),
              (0, a.jsx)(g.Portal, {
                children: (0, a.jsx)(g.Content, {
                  side: "bottom",
                  align: "start",
                  className: (0, p.A)(f()["drop-menu"]),
                  children: r.map((e) =>
                    (0, a.jsx)(
                      g.Item,
                      {
                        className: f()["drop-menu-item"],
                        onClick: () => n.push(e.href),
                        children: e.title,
                      },
                      e.title
                    )
                  ),
                }),
              }),
            ],
          }),
        });
      };
      var b = r(57259),
        y = r(53863),
        v = r.n(y),
        k = r(30900),
        S = r(39957),
        C = r(26039),
        H = r(47605),
        N = r(71207);
      let x = (0, d.forwardRef)((e, t) => {
        let { headerHeight: r, items: n, isOpened: o } = e,
          i = (0, d.useRef)(H.Ay.timeline({ paused: !0 })),
          l = (0, d.useRef)(H.Ay.timeline({ paused: !0 })),
          u = (0, d.useRef)(null),
          m = (0, d.useRef)([]),
          g = (0, d.useRef)(null),
          _ = (0, d.useRef)(null),
          f = (0, d.useRef)([]),
          [w, y] = (0, d.useState)([]),
          x = (0, d.useCallback)(() => {
            (H.Ay.set(g.current, { pointerEvents: "none" }),
              l.current.pause(),
              i.current.play(0),
              y([]),
              (document.body.style.overflow = "auto"),
              document.body.removeAttribute("data-lenis-prevent"));
          }, []);
        return (
          (0, d.useEffect)(
            () => () => {
              ((document.body.style.overflow = "auto"),
                document.body.removeAttribute("data-lenis-prevent"));
            },
            []
          ),
          (0, d.useImperativeHandle)(t, () => ({
            hide: x,
            show: () => {
              (i.current.pause(),
                l.current.play(0),
                H.Ay.set(g.current, { pointerEvents: "auto", opacity: 1, immediateRender: !1 }),
                (document.body.style.overflow = "hidden"),
                document.body.setAttribute("data-lenis-prevent", "true"));
            },
            kill: () => {
              (i.current.pause(),
                i.current.progress(0),
                l.current.pause(),
                l.current.progress(0),
                (document.body.style.overflow = "auto"),
                document.body.removeAttribute("data-lenis-prevent"));
            },
          })),
          (0, S.L)(() => {
            (l.current.fromTo(
              u.current,
              { scaleY: 0 },
              {
                scaleY: 1,
                duration: 0.7,
                ease: N.M.create("", ".76, 0, .2, 1"),
                immediateRender: !1,
              },
              0
            ),
              l.current.add((0, C.z4)(m.current), 0.4),
              l.current.add((0, C.gr)(_.current), 0.6),
              l.current.add((0, C.gr)(f.current), 0.6));
          }),
          (0, S.L)(() => {
            (i.current.fromTo(
              u.current,
              { scaleY: 1 },
              {
                scaleY: 0,
                duration: 0.7,
                ease: N.M.create("", ".76, 0, .2, 1"),
                immediateRender: !1,
              },
              0
            ),
              i.current.fromTo(
                g.current,
                { opacity: 1 },
                {
                  opacity: 0,
                  duration: 0.7,
                  ease: N.M.create("", ".76, 0, .2, 1"),
                  immediateRender: !1,
                },
                0
              ));
          }),
          (0, a.jsxs)("div", {
            ref: g,
            className: (0, p.A)(v().wrapper, o && v()["-active"]),
            style: { paddingTop: r },
            "data-lenis-prevent": !0,
            children: [
              (0, a.jsx)("div", { ref: u, className: (0, p.A)(v().backdrop, o && v()["-active"]) }),
              (0, a.jsx)("div", {
                className: v().content,
                children: (0, a.jsx)("nav", {
                  className: v().nav,
                  children: n.map((e) =>
                    e.children
                      ? (0, a.jsxs)(
                          b.Root,
                          {
                            open: w.includes(e.title),
                            onOpenChange: (t) => {
                              y((r) => (t ? [...r, e.title] : r.filter((t) => t !== e.title)));
                            },
                            children: [
                              (0, a.jsx)(b.Trigger, {
                                asChild: !0,
                                children: (0, a.jsxs)(
                                  "div",
                                  {
                                    ref: (e) => {
                                      e && m.current.push(e);
                                    },
                                    className: v()["nav-item"],
                                    children: [
                                      e.title,
                                      (0, a.jsx)("div", {
                                        ref: (e) => {
                                          e && f.current.push(e);
                                        },
                                        className: v()["nav-item-arrow"],
                                        children: (0, a.jsx)(s.h, {
                                          width: "2.4rem",
                                          height: "2.4rem",
                                        }),
                                      }),
                                    ],
                                  },
                                  e.title
                                ),
                              }),
                              (0, a.jsx)(b.Content, {
                                className: v()["nav-item-content"],
                                children: (0, a.jsx)("div", {
                                  className: v()["nav-item-content-inner"],
                                  children: e.children.map((e) =>
                                    (0, a.jsx)(
                                      "div",
                                      {
                                        className: v()["nav-sub-item"],
                                        children: (0, a.jsx)(h(), {
                                          href: e.href,
                                          children: e.title,
                                        }),
                                      },
                                      e.title
                                    )
                                  ),
                                }),
                              }),
                            ],
                          },
                          e.title
                        )
                      : e.href
                        ? (0, a.jsx)(
                            "div",
                            {
                              ref: (e) => {
                                e && m.current.push(e);
                              },
                              className: v()["nav-item"],
                              children: (0, a.jsx)(h(), { href: e.href, children: e.title }),
                            },
                            e.title
                          )
                        : void 0
                  ),
                }),
              }),
              (0, a.jsx)("div", {
                ref: _,
                className: v().actions,
                children: (0, a.jsx)(k.$, {
                  asChild: !0,
                  text: "Entrar",
                  children: (0, a.jsx)(h(), { href: c.a.signInAgentPortal, children: "Entrar" }),
                }),
              }),
            ],
          })
        );
      });
      var P = r(58742),
        M = r.n(P);
      let B = (e) => {
        let { isOpened: t, onClick: r, className: n } = e;
        return (0, a.jsxs)("button", {
          className: (0, p.A)(M().btn, t && M()["-active"], n),
          "aria-label": "Controle do menu",
          "aria-expanded": t,
          onClick: r,
          children: [(0, a.jsx)("span", {}), (0, a.jsx)("span", {})],
        });
      };
      var j = r(75436),
        A = r(47845);
      let W = [
          { title: "Buscar", href: c.a.search },
          { title: "Agentes", href: c.a.agents },
          { title: "Faça Parte", href: c.a.join },
          {
            title: "Documentação",
            children: [
              { title: "Enviar uma solicitação", href: c.a.applyActual },
              { title: "Fazer um pagamento", href: c.a.paymentsActual },
              { title: "Formulários online", href: c.a.onlineFormsActual },
            ],
          },
          {
            title: "Recursos",
            children: [
              { title: "Parcerias úteis", href: c.a.helpfulPartnerships },
              { title: "Comercial", href: c.a.commercial },
              { title: "Procedimento Operacional", href: c.a.operatingProcedure },
            ],
          },
          {
            title: "Sobre",
            children: [
              { title: "Sobre Nós", href: c.a.about },
              { title: "Blog", href: c.a.blog },
              { title: "Imprensa", href: c.a.press },
            ],
          },
        ],
        E = (e) => {
          let { color: t = "light", isWide: r = !1 } = e,
            [o, u] = (0, d.useState)(!1),
            [g, _] = (0, d.useState)(!1),
            [f, b] = (0, d.useState)(!0),
            y = (0, d.useRef)(null),
            v = (0, d.useRef)(0),
            [S, C] = (0, d.useState)(0),
            H = (0, m.usePathname)(),
            { isMobile: N, isInitialized: P } = (0, j.dv)(),
            M = (0, d.useRef)(null);
          ((0, d.useEffect)(() => {
            y.current && C(y.current.clientHeight);
          }, []),
            (0, d.useEffect)(() => {
              o && (u(!1), M.current?.hide());
            }, [H]),
            (0, A.d)(
              (e) => {
                o && e > 768 && (u(!1), M.current?.kill());
              },
              [o]
            ));
          let E = (0, d.useCallback)(() => {
            if (H === c.a.search && P && !N) {
              (b(!0), _(!1));
              return;
            }
            let e = window.scrollY,
              t = v.current;
            if (e < 100) {
              (b(!0), (v.current = e));
              let t = e > 3 * window.innerHeight;
              _((e) => (e !== t ? t : e));
              return;
            }
            if (t > 0) {
              let r = e > t;
              e < t ? b(!0) : r && b(!1);
            } else b(!0);
            v.current = e;
            let r = e > 3 * window.innerHeight;
            _((e) => (e !== r ? r : e));
          }, [H, P, N]);
          return (
            (0, d.useEffect)(
              () => (
                (v.current = window.scrollY),
                E(),
                window.addEventListener("scroll", E),
                () => {
                  window.removeEventListener("scroll", E);
                }
              ),
              [E]
            ),
            (0, a.jsxs)("header", {
              className: (0, p.A)(
                i().wrapper,
                "dark" === t && i().dark,
                "transparent" === t && i().transparent,
                o && i()["-opened"],
                g && i()["-fixed"],
                !f && i()["-hidden"]
              ),
              ref: y,
              children: [
                (0, a.jsx)(n.m, {
                  isWide: r,
                  children: (0, a.jsxs)("div", {
                    className: i().content,
                    children: [
                      (0, a.jsx)("div", {
                        className: i().logo,
                        children: (0, a.jsx)(h(), {
                          href: c.a.home,
                          children: (0, a.jsx)("img", {
                            src: "/assets/7lm_logo_cropped.png",
                            alt: "7LM",
                            width: 288,
                            height: 95,
                          }),
                        }),
                      }),
                      (0, a.jsx)("nav", {
                        className: i().nav,
                        children: W.map((e) =>
                          e.children
                            ? (0, a.jsx)(
                                w,
                                {
                                  items: e.children,
                                  children: (t) =>
                                    (0, a.jsxs)("div", {
                                      className: i()["nav-item"],
                                      children: [
                                        (0, a.jsx)("span", {
                                          "data-text": e.title,
                                          children: e.title,
                                        }),
                                        (0, a.jsx)("div", {
                                          className: (0, p.A)(
                                            i()["nav-arrow"],
                                            t && i()["-rotated"]
                                          ),
                                          children: (0, a.jsx)(s.h, {}),
                                        }),
                                      ],
                                    }),
                                },
                                e.title
                              )
                            : (0, a.jsx)(
                                "div",
                                {
                                  className: i()["nav-item"],
                                  children: (0, a.jsx)(h(), {
                                    href: e.href,
                                    children: (0, a.jsx)("span", {
                                      "data-text": e.title,
                                      children: e.title,
                                    }),
                                  }),
                                },
                                e.title
                              )
                        ),
                      }),
                      (0, a.jsx)("div", {
                        className: i().actions,
                        children: (0, a.jsx)(k.$, {
                          asChild: !0,
                          text: "Entrar",
                          children: (0, a.jsx)(h(), {
                            href: c.a.signInAgentPortal,
                            children: (0, a.jsx)("span", {
                              "data-text": "Entrar",
                              children: "Entrar",
                            }),
                          }),
                        }),
                      }),
                      (0, a.jsx)(B, {
                        isOpened: o,
                        onClick: () => {
                          o ? (M.current?.hide(), u(!1)) : (M.current?.show(), u(!0));
                        },
                        className: i()["burger-control"],
                      }),
                    ],
                  }),
                }),
                (0, a.jsx)(x, { ref: M, headerHeight: S, items: W, isOpened: o }),
              ],
            })
          );
        };
    },
    53863: (e) => {
      e.exports = {
        em: "burger-menu_em__xC1sw",
        invisible: "burger-menu_invisible__T8MQG",
        "desktop-only": "burger-menu_desktop-only__BmQnS",
        "mobile-only": "burger-menu_mobile-only__mBGnh",
        underline: "burger-menu_underline__QieTS",
        "dropdown-item": "burger-menu_dropdown-item__BO7tk",
        "dropdown-content": "burger-menu_dropdown-content__BXXpy",
        "dropdown-trigger": "burger-menu_dropdown-trigger__OGeXp",
        underlined: "burger-menu_underlined__fBXSZ",
        outlined: "burger-menu_outlined__dGay7",
        wrapper: "burger-menu_wrapper__gKR7D",
        backdrop: "burger-menu_backdrop__wfXK5",
        content: "burger-menu_content__rv4kf",
        nav: "burger-menu_nav__dAhwA",
        "nav-item": "burger-menu_nav-item__mCA9u",
        "nav-sub-item": "burger-menu_nav-sub-item__1Y2N1",
        "nav-item-content": "burger-menu_nav-item-content__kj0Kw",
        "nav-item-content-inner": "burger-menu_nav-item-content-inner__Kjqha",
        slideDown: "burger-menu_slideDown__ReXzg",
        slideUp: "burger-menu_slideUp__L9EMs",
        actions: "burger-menu_actions__In3qE",
      };
    },
    58742: (e) => {
      e.exports = {
        em: "burger-btn_em__NTSIl",
        invisible: "burger-btn_invisible__5qujN",
        "desktop-only": "burger-btn_desktop-only__UZD9O",
        "mobile-only": "burger-btn_mobile-only__37_JF",
        underline: "burger-btn_underline__ordT1",
        "dropdown-item": "burger-btn_dropdown-item__DhZoc",
        "dropdown-content": "burger-btn_dropdown-content__5CpgE",
        "dropdown-trigger": "burger-btn_dropdown-trigger__5XcKT",
        underlined: "burger-btn_underlined__XpP1I",
        outlined: "burger-btn_outlined__u6NTm",
        btn: "burger-btn_btn__IvzqD",
        "-active": "burger-btn_-active__gfidG",
      };
    },
    65169: (e, t, r) => {
      "use strict";
      r.d(t, { h: () => i });
      var a,
        n = r(12115);
      function o() {
        return (o = Object.assign
          ? Object.assign.bind()
          : function (e) {
              for (var t = 1; t < arguments.length; t++) {
                var r = arguments[t];
                for (var a in r) ({}).hasOwnProperty.call(r, a) && (e[a] = r[a]);
              }
              return e;
            }).apply(null, arguments);
      }
      let i = (e) =>
        n.createElement(
          "svg",
          o({ xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }, e),
          a ||
            (a = n.createElement("path", {
              fill: "currentColor",
              fillRule: "evenodd",
              d: "M17.566 9.431a.8.8 0 0 1 .005 1.131l-1.78 1.797c-.669.674-1.218 1.229-1.708 1.622-.51.41-1.034.712-1.665.792a3.3 3.3 0 0 1-.83 0c-.63-.08-1.154-.382-1.665-.792-.49-.393-1.04-.948-1.707-1.622l-1.781-1.797A.8.8 0 0 1 7.57 9.436L9.32 11.2c.71.716 1.195 1.205 1.606 1.535.398.32.648.424.866.452q.211.027.424 0c.219-.028.468-.133.866-.452.41-.33.897-.819 1.607-1.535l1.747-1.763a.8.8 0 0 1 1.131-.005",
              clipRule: "evenodd",
            }))
        );
    },
    78064: (e, t, r) => {
      "use strict";
      r.d(t, { CE: () => n, GI: () => a, V$: () => i, d$: () => o });
      let a = [
          "All Specialties",
          "Residential Sales",
          "Commercial Sales",
          "Residential Rentals",
          "Commercial Leasing",
          "Retail Leasing",
          "Investment Sales",
          "Office Leasing",
        ],
        n = [
          "Abilene Heights Area",
          "All Downtown",
          "Alphabet City",
          "Alphabet City - East Village",
          "Amagansett",
          "Amity Harbor",
          "Amityville",
          "Annadale",
          "Armourdale",
          "Arrochar",
          "Arverne",
          "Astoria",
          "Atlantic Beach",
          "Atlantique",
          "Auburndale",
          "Austerlitz",
          "Babylon",
          "Baiting Hollow",
          "Baldwin",
          "Barnes",
          "Bath Beach",
          "Battery Park City",
          "Bay Ridge",
          "Bay Shore",
          "Bay Terrace",
          "Baychester",
          "Bayonne",
          "Bayside",
          "Bayview",
          "Bayville",
          "Bed-Stuy",
          "Bedford Park",
          "Bedford Stuyvesant",
          "Bedford-Stuyvesant",
          "Beechhurst",
          "Beekman",
          "Beekman Place",
          "Belgravia",
          "Belle Harbor",
          "Belle Terre",
          "Bellerose",
          "Bellerose Manor",
          "Bellmore",
          "Bellport",
          "Bellport Village",
          "Belmont",
          "Bensonhurst",
          "Bergen Beach",
          "Bethpage",
          "Blackstone",
          "Boerum Hill",
          "Borough Park",
          "Bowie",
          "Breezy Point",
          "Brentwood",
          "Briarwood",
          "Bridgehampton",
          "Brighton Beach",
          "Brightwaters",
          "Broad Channel",
          "Bronx",
          "Bronx (Other)",
          "Bronxwood",
          "Brookhaven",
          "Brooklyn",
          "Brooklyn Heights",
          "Brookville",
          "Brownsville",
          "Bulls Head",
          "Bushwick",
          "Bushwick / BedStuy",
          "Bushwick/Bed-Stuy",
          "Calverton",
          "Camberwell",
          "Cambria Heights",
          "Camelback East Village",
          "Canarsie",
          "Canary Wharf",
          "Capitol Hill",
          "Carle Place",
          "Carnegie Hill",
          "Carroll Garden",
          "Carroll Gardens",
          "Cedarhurst",
          "Center City West",
          "Center Moriches",
          "Center Square & Hudson/Park",
          "Centereach",
          "Centerport",
          "Central Arlington",
          "Central Harlem",
          "Central Islip",
          "Central Minneapolis",
          "Central Oklahoma City",
          "Central Oshawa",
          "Central Park South",
          "Central Park West",
          "Central Park West Historic District",
          "Centre Island",
          "Chapinero",
          "Chelsea",
          "Chelsea (Staten Island)",
          "Cherry Grove Beach",
          "Chicago Loop",
          "chinaown",
          "Chinatown",
          "Chisholm Creek",
          "Chiswick",
          "City Island",
          "City Line",
          "Civic Center",
          "Claremont",
          "Clearview",
          "Clerkenwell",
          "Clifton",
          "Clinton",
          "Clinton Hill",
          "clinton Hills",
          "Cobble Hill",
          "Cold Spring Hrbr",
          "College Point",
          "Columbia St Waterfront District",
          "Columbia Street Waterfront",
          "Columbia Street Waterfront District",
          "Commack",
          "Concord",
          "Concourse",
          "Concourse Village",
          "Coney Island",
          "Copiague",
          "Corona",
          "Country Club",
          "Cove Neck",
          "Crotona Park East",
          "Crown Heights",
          "Cypress Hills",
          "Deer Park",
          "Ditmars Steinway",
          "Ditmars-Steinway",
          "Ditmas Park",
          "Dix Hills",
          "Dixieland",
          "Dongan Hills",
          "Douglaston",
          "Downtown",
          "Downtown Brooklyn",
          "Downtown Kansas City",
          "Dumbo",
          "Dyker",
          "Dyker Heights",
          "E. Greenwich Village",
          "Earls Court",
          "Ease Harlem",
          "East Bronx",
          "East Elmhurst",
          "East End",
          "East Flatbush",
          "East Flushing",
          "East Hampton",
          "East Harlem",
          "East Hills",
          "East Islip",
          "East Meadow",
          "East Moriches",
          "East New York",
          "East Northport",
          "East Norwich",
          "East Patchogue",
          "East Quogue",
          "East Rockaway",
          "East Setauket",
          "East Syracuse",
          "East Topeka North",
          "East Tremont",
          "East Village",
          "East Williamsburg",
          "East Williston",
          "Eastchester",
          "Eastport",
          "Edgewater Borough",
          "El Pueblo",
          "Elm Park",
          "Elmhurst",
          "Elmont",
          "Eltingville",
          "Fair Harbor",
          "Far North Dallas",
          "Far Rockaway",
          "Farmingdale",
          "Farmingville",
          "Farragut",
          "Fashion District",
          "Fieldston",
          "Financial District",
          "Fire Island Pines",
          "Fiske Terrace",
          "Fitzrovia",
          "Flanders",
          "Flatbush",
          "Flatiron",
          "Flatiron - Gramercy",
          "Flatiron District",
          "Flatlands",
          "Floral Park",
          "Flower Hill",
          "Flushing",
          "Fondren",
          "Fordham",
          "Fordham Heights",
          "Fordham Manor",
          "Forest Hills",
          "Forest Hills Gardens",
          "Fort George",
          "Fort Greene",
          "Fort Hamilton",
          "Fort Salonga",
          "Franklin Square",
          "Freeport",
          "Fresh Meadows",
          "Fulham",
          "Fulton/Seaport",
          "Garden City Park",
          "Garment District",
          "Georgetown",
          "Gerritsen Beach",
          "Gilgo",
          "Glen Cove",
          "Glen Head",
          "Glen Oaks",
          "Glendale",
          "Glenwood Landing",
          "Gowanus",
          "Gramercy",
          "Gramercy Park",
          "Graniteville",
          "Grant City",
          "Grasmere",
          "Gravesend",
          "Great Bridge",
          "Great Kills",
          "Great Neck",
          "Great River",
          "Green point",
          "Greenpoint",
          "Greenvale",
          "Greenville",
          "Greenwich",
          "Greenwich Village",
          "Greenwood",
          "Greenwood Heights",
          "Grymes hill",
          "Halesite",
          "Hamilton Heights",
          "Hammels",
          "Hampstead",
          "Hampton Bays",
          "Harlem",
          "Harringay",
          "Hartford",
          "Hartsdale",
          "Hauppauge",
          "Head Of Harbor",
          "Heartened Village ",
          "Heartland Village",
          "Hell's Kitchen",
          "Hempstead",
          "Herald Sq",
          "Herald Square",
          "Hewlett",
          "Hewlett Bay Park",
          "Hewlett Harbor",
          "Hewlett Neck",
          "Hicksville",
          "High Bridge",
          "Highbridge",
          "Highbury East",
          "Highgate",
          "Highland",
          "Highland Park",
          "Hillcrest",
          "Hoboken",
          "Holbrook",
          "Hollis",
          "Hollis Hills",
          "Holliswood",
          "Holtsville",
          "Homecrest",
          "Howard Beach",
          "Hudson County",
          "Hudson Heights",
          "Hudson Square",
          "Hudson Yard",
          "Hudson Yards",
          "Hunters Point",
          "Huntington Bay",
          "Huntington Station",
          "Hunts Point",
          "Inwood",
          "Island Park",
          "Islandia",
          "Isle of Dogs",
          "Islip",
          "Islip Terrace",
          "Ivey Ranch / Rancho Del Oro",
          "Jackson Heights",
          "Jamaica",
          "Jamaica Estates",
          "Jamaica Hills",
          "Jericho",
          "Jersey City",
          "Joffre",
          "Kensington",
          "Kew Gardens",
          "Kew Gardens Hills",
          "Kings Cross",
          "Kings Park",
          "Kings Point",
          "Kingsbridge",
          "Kingsbridge Heights",
          "Kips Bay",
          "Kismet",
          "Knightsbridge",
          "Koolauloa",
          "Koreatown",
          "Laconia",
          "Lake Grove",
          "Lake Ronkonkoma",
          "Lambeth",
          "Lattingtown",
          "Laurel",
          "Laurel Hollow",
          "Laurelton",
          "Lawrence",
          "Leamouth Peninsula",
          "Lenox Hill",
          "Levittown",
          "Lido Beach",
          "Lincoln Square",
          "Lindenhurst",
          "Lindenwood",
          "Little Italy",
          "Little Neck",
          "Lloyd Harbor",
          "Lloyd Neck",
          "Locust Point",
          "Locust Valley",
          "Long Beach",
          "Long Island City",
          "Longwood",
          "Longwood Forest",
          "Longwood Village",
          "Lower East Side",
          "Lower Manhattan",
          "Lynbrook",
          "Madison",
          "Maida Vale",
          "Malba",
          "Malverne",
          "Manhasset",
          "Manhasset Hills",
          "Manhattan",
          "Manhattan Beach",
          "Manhattan Valley",
          "Manhattanville",
          "Manor Heights",
          "Manorville",
          "Mapleton",
          "Marble Hill",
          "Marine Park",
          "Mariner's Harbor",
          "Marylebone",
          "Maspeth",
          "Massapequa",
          "Massapequa Park",
          "Mastic Beach",
          "Matinecock",
          "May Moore Area",
          "Meatpacking",
          "Meatpacking District",
          "Medford",
          "Meiers Corners",
          "Melrose",
          "Melville",
          "Mid Island",
          "Mid town",
          "Middle East Side",
          "Middle Island",
          "Middle Village",
          "Middlefield Center",
          "Midland Beach",
          "Midtown",
          "Midtown Atlanta",
          "Midtown Center",
          "Midtown Crossing",
          "Midtown East",
          "Midtown Manhattan",
          "Midtown South",
          "Midtown West",
          "Midwood",
          "Mildmay Ward",
          "Mill Basin",
          "Mill Neck",
          "Miller Place",
          "Mineola",
          "Mixed",
          "Montauk",
          "Moriches",
          "Morningside Heights",
          "Morris Heights",
          "Morris Park",
          "Morrisania",
          "Mott Haven",
          "Mount Eden",
          "Mount Hope",
          "Mt. Hope",
          "Mt. Morris Park",
          "Mt. Sinai",
          "Murray Hill",
          "Murray Hill (Queens)",
          "Muttontown",
          "Myrtle Avenue",
          "Neponsit",
          "Nesconset",
          "New Brighton",
          "New Dorp",
          "New Dorp Beach",
          "New Downtown",
          "New Hyde Park",
          "New Lots",
          "New Springville",
          "Nissequogue",
          "NoHo",
          "Nolita",
          "NoMad",
          "North Amityville",
          "North Babylon",
          "North Baldwin",
          "North Bellmore",
          "North Corona",
          "North Fork",
          "North Haven",
          "North Hills",
          "North Maida Vale",
          "North Massapequa",
          "North Merrick",
          "North New York",
          "North Park",
          "North Riverdale",
          "North Woodmere",
          "Northeast Oklahoma City",
          "Northeast Orlando",
          "Northport",
          "Northside",
          "Northwest Blvd",
          "Northwest Washington",
          "Norwood",
          "Norwood Park",
          "Oak Beach",
          "Oak Island",
          "Oakland Gardens",
          "Ocean Bay Park",
          "Ocean Beach",
          "Ocean Hill",
          "Ocean Parkway",
          "Oceanside",
          "Old Bethpage",
          "Old Brookville",
          "Old Field",
          "Old Howard Beach",
          "Old Irving Park",
          "Old Mill Basin",
          "Old Westbury",
          "Orient",
          "Out Of Area Town",
          "Oyster Bay",
          "Oyster Bay Cove",
          "Ozone Park",
          "Paddington",
          "Park Hill",
          "Park Slope",
          "Park Slope/Gowanus",
          "Parkchester",
          "Patchogue",
          "Paterson",
          "Patterson Place",
          "Peachtree Center",
          "Pehelam bay",
          "Pelham Bay",
          "Pelham Gardens",
          "Pelham Parkway",
          "Pelton Crossing",
          "Penn",
          "Penn Station,",
          "Peter Cooper Village",
          "Pimlico",
          "Pine Hills",
          "Planeview United",
          "Point Lookout",
          "Pomonok",
          "Poplar",
          "Poquott",
          "Port Authority",
          "Port Jefferson",
          "Port Jefferson Station",
          "Port Morris",
          "Port Richmond",
          "Port Washington",
          "Prospect Heights",
          "Prospect Leffert Gdn",
          "Prospect Lefferts Gardens",
          "Prospect Park South",
          "Queens",
          "Queens (Other)",
          "Queens Village",
          "Queensboro Hill",
          "Quogue",
          "Ranch Acres",
          "Red Hook",
          "Rego Park",
          "Remsen Village",
          "Remsenburg",
          "Richmond",
          "Richmond Hill",
          "Richmondtown",
          "Ridge",
          "Ridgewood",
          "River Market",
          "Riverdale",
          "Rochdale",
          "Rockaway All",
          "Rockaway Beach",
          "Rockaway Park",
          "Rockville Centre",
          "Rocky Point",
          "Ronkonkoma",
          "Roosevelt",
          "Roosevelt Island",
          "Rosebank",
          "Rosedale",
          "Roslyn",
          "Roslyn Estates",
          "Roslyn Harbor",
          "Roslyn Heights",
          "Rossville",
          "Sag Harbor",
          "Sagaponack",
          "Saint Albans",
          "Saint George",
          "Saint James",
          "Sands Point",
          "Sayville",
          "Schuylerville",
          "Sea Cliff",
          "Seaford",
          "Seagate",
          "Seaport District",
          "Searingtown",
          "Selden",
          "Setauket",
          "Sheepshead Bay",
          "Sheldon Hills",
          "Shelter Island",
          "Shelter Island Heights",
          "Shirley",
          "Shore Acres",
          "Shoreham",
          "Shorehaven",
          "Skunk City",
          "Smithtown",
          "SoHo",
          "Sound Beach",
          "Soundview",
          "South Beach",
          "South End",
          "South Farmingdale",
          "South Floral Park",
          "South Harlem",
          "South Hempstead",
          "South Huntington",
          "South Jamaica",
          "South Jamesport",
          "South Ozone Park",
          "South Richmond Hill",
          "South Setauket",
          "South Slope",
          "South Slope Brewing District",
          "South Williamsburg",
          "Southampton",
          "Southeast Annadale",
          "Southold",
          "Southwest Carrollton",
          "Southwest Minneapolis",
          "Speonk",
          "Springfield Gardens",
          "Spuyten Duyvil",
          "St. Albans",
          "Stapleton",
          "Staten Island",
          "Steinway-Ditmars",
          "Stewart Manor",
          "Stoke Newington",
          "Stony Brook",
          "Stony Ridge Estates",
          "Strong",
          "Stroud Green",
          "Stuyvesant Heights",
          "Stuyvesant Town",
          "Stuyvesant Town-Peter Cooper Village",
          "Stuyvesant Town/PCV",
          "Suffolk",
          "Sunnyside",
          "Sunnyside Gardens",
          "Sunset Park",
          "Sutton Place",
          "Syosset",
          "The Port",
          "The Village Of Overland Pointe",
          "Theater District",
          "Thompson Park",
          "Thornwood",
          "Throgs Neck",
          "Todt Hill",
          "Tompkinsville",
          "Tottenville",
          "Travis - Chelsea",
          "Tremont",
          "Tribeca",
          "Tudor City",
          "Turtle Bay",
          "Two Bridges",
          "Ulus Istanbul",
          "Union Square",
          "Uniondale",
          "Unionport",
          "University Heights",
          "Upper Brookville",
          "Upper Carnegie Hill",
          "Upper East Side",
          "Upper Manhattan",
          "Upper West Side",
          "Uptown",
          "Utopia",
          "Valley Stream",
          "Van Nest",
          "Village of Orchard Park",
          "Vinegar Hill",
          "W. Greenwich Village",
          "Wading River",
          "Wainscott",
          "Wakefield",
          "Walthamstow",
          "Wantagh",
          "Wareham Center",
          "Warrenton",
          "Washington Heights",
          "Water Island",
          "Water Mill",
          "Weeksville",
          "West",
          "West Babylon",
          "West Brighton",
          "West Bronx",
          "West Chelsea",
          "West Harlem",
          "West Hempstead",
          "West Islip",
          "West New York",
          "West Norwood",
          "West Sayville",
          "West Southwest 2",
          "West Village",
          "West Villiage",
          "Westbury",
          "Westchester County",
          "Westchester Square",
          "Westerleigh",
          "Westhampton",
          "Westhampton Beach",
          "Westhampton Dune",
          "Westminster",
          "Westpark Square Professional Center",
          "Westside",
          "Wheatley Heights",
          "White City",
          "Whitestone",
          "Williamsbridge",
          "Williamsburg",
          "Williston Park",
          "Wimbledon Champions Estates",
          "Windsor Terrace",
          "Wingate",
          "Winterberry",
          "Wood Green",
          "Woodbury",
          "Woodfield Commons",
          "Woodhaven",
          "Woodlawn",
          "Woodmere",
          "Woodrow Park",
          "Woodsburgh",
          "Woodside",
          "Woodstock",
          "Wrigleyville",
          "Wyandanch",
          "Yaphank",
          "Yonkers",
          "Yorkville",
        ],
        o = Object.entries({
          AL: "Alabama",
          AK: "Alaska",
          AS: "American Samoa",
          AZ: "Arizona",
          AR: "Arkansas",
          CA: "California",
          CO: "Colorado",
          CT: "Connecticut",
          DE: "Delaware",
          DC: "District of Columbia",
          FL: "Florida",
          GA: "Georgia",
          GU: "Guam",
          HI: "Hawaii",
          ID: "Idaho",
          IL: "Illinois",
          IN: "Indiana",
          IA: "Iowa",
          KS: "Kansas",
          KY: "Kentucky",
          LA: "Louisiana",
          ME: "Maine",
          MD: "Maryland",
          MA: "Massachusetts",
          MI: "Michigan",
          MN: "Minnesota",
          MS: "Mississippi",
          MO: "Missouri",
          MT: "Montana",
          NE: "Nebraska",
          NV: "Nevada",
          NH: "New Hampshire",
          NJ: "New Jersey",
          NM: "New Mexico",
          NY: "New York",
          NC: "North Carolina",
          ND: "North Dakota",
          MP: "Northern Mariana Islands",
          OH: "Ohio",
          OK: "Oklahoma",
          OR: "Oregon",
          PA: "Pennsylvania",
          PR: "Puerto Rico",
          RI: "Rhode Island",
          SC: "South Carolina",
          SD: "South Dakota",
          TN: "Tennessee",
          TX: "Texas",
          UT: "Utah",
          VT: "Vermont",
          VI: "Virgin Islands",
          VA: "Virginia",
          WA: "Washington",
          WV: "West Virginia",
          WI: "Wisconsin",
          WY: "Wyoming",
        }).map((e) => {
          let [t, r] = e;
          return { label: r, value: t };
        }),
        i = {
          facebook: "https://facebook.com/findrealestate.hq",
          instagram: "https://www.instagram.com/findrealestate.hq",
          youtube: "https://www.youtube.com/@findrealestate_hq",
          linkedin: "https://www.linkedin.com/company/oxford-property-group",
        };
    },
    81591: (e) => {
      e.exports = {
        em: "drop-menu_em__4TsDt",
        invisible: "drop-menu_invisible__G7ntD",
        "desktop-only": "drop-menu_desktop-only__xJ2KI",
        "mobile-only": "drop-menu_mobile-only___81ZP",
        underline: "drop-menu_underline__alPB1",
        "dropdown-item": "drop-menu_dropdown-item__37Aun",
        "dropdown-content": "drop-menu_dropdown-content__iNwBT",
        "dropdown-trigger": "drop-menu_dropdown-trigger__JFfQs",
        underlined: "drop-menu_underlined__p78Il",
        outlined: "drop-menu_outlined__15MYS",
        "drop-menu": "drop-menu_drop-menu__1Wc1_",
        appear: "drop-menu_appear__iEaKs",
        "drop-menu-item": "drop-menu_drop-menu-item__yOc_f",
      };
    },
    93820: (e, t, r) => {
      "use strict";
      r.d(t, { a: () => a });
      let a = {
        home: "/",
        propertyListing: "/properties",
        propertyDetails: (e, t) => `/properties/${e}${t ? `?status=${t}` : ""}`,
        agentDetails: (e) => `/agents/${e}`,
        join: "/join",
        apply: "/apply-online",
        applyActual: "https://app.findrealestate.com/public/apply",
        certifiedAgents: "/certified-agents",
        agents: "/agents",
        about: "/about",
        search: "/search",
        terms: "/terms-of-service",
        privacy: "/privacy-policy",
        press: "/press-and-media",
        fairHousingNotice:
          "https://dos.ny.gov/system/files/documents/2025/03/nys-housing-and-anti-discrimination-notice_02.2025.pdf",
        helpfulPartnerships: "/helpful-partnerships",
        commercial: "/services",
        operatingProcedure: "/operating-procedure",
        blog: "/blog",
        blogPost: (e) => `/blog/${e}`,
        payments: "/payments",
        paymentsActual: "https://app.findrealestate.com/public/payments",
        onlineFormsActual: "https://app.findrealestate.com/public/online-forms",
        signInAgentPortal: "https://app.findrealestate.com/authentication/sign-in",
        social: {
          facebook: "/social/facebook",
          linkedin: "/social/linkedin",
          twitter: "/social/twitter",
          youtube: "/social/youtube",
          instagram: "/social/instagram",
        },
      };
    },
  },
]);
