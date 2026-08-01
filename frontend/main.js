window.addEventListener("load", function () {
  const loader = document.getElementById("loading-screen");
  if (!loader) return;

  setTimeout(function () {
    loader.classList.add("hidden");
    setTimeout(function () {
      loader.remove();
    }, 1000);
  }, 3000);
});

function readBenzyStoredApiBase() {
  const stored = String(localStorage.getItem("benzy_api_base") || "").trim();
  if (!stored) return "";
  try {
    const hostname = new URL(stored).hostname;
    if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
      localStorage.removeItem("benzy_api_base");
      return "";
    }
  } catch {
    localStorage.removeItem("benzy_api_base");
    return "";
  }
  return stored;
}

(function () {
  const root = document.documentElement;

  if (!(root instanceof HTMLElement)) return;

  let hideTimer = 0;

  function showScrollbars() {
    root.classList.add("bl-scrollbars-visible");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(function () {
      root.classList.remove("bl-scrollbars-visible");
    }, 900);
  }

  document.addEventListener("scroll", showScrollbars, { capture: true, passive: true });
  document.addEventListener("wheel", showScrollbars, { passive: true });
  document.addEventListener("touchmove", showScrollbars, { passive: true });
  document.addEventListener("keydown", function (event) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
      showScrollbars();
    }
  });
})();

(function () {
  const page = window.location.pathname.toLowerCase();
  const isAdminPage = page.endsWith("/admin.html")
    || page.endsWith("admin.html")
    || page.endsWith("/admindashboard.html")
    || page.endsWith("admindashboard.html");
  const isProfilePage = page.endsWith("/profile.html")
    || page.endsWith("profile.html");

  if (window.__BENZY_SKIP_SITE_FOOTER || isAdminPage || isProfilePage || !document.body || document.querySelector("[data-site-footer]")) return;

  const footer = document.createElement("footer");
  footer.className = "bl-site-footer";
  footer.setAttribute("data-site-footer", "true");
  footer.innerHTML = `
    <div class="bl-site-footer__inner">
      <div class="bl-site-footer__top">
        <section class="bl-site-footer__brand">
          <img src="OFF BACK/BLX.png" alt="Benzy Luxury" class="bl-site-footer__logo">
          <h3 class="bl-site-footer__headline" data-site-footer-headline>Benzy Luxury</h3>
          <p class="bl-site-footer__summary" data-site-footer-summary>At Benzy Luxury, we believe that fashion is an expression of individuality and artistry.</p>
          <div class="bl-site-footer__socials" aria-label="Social links">
            <a href="https://x.com/benzyluxury" aria-label="X" target="_blank" rel="noopener noreferrer">
              <img src="OFF BACK/icons8-x-50.png" alt="X">
            </a>
            <a href="https://www.instagram.com/benzyluxury_" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
              <img src="OFF BACK/icons8-instagram-50.png" alt="Instagram">
            </a>
            <a href="https://www.pinterest.com/benzylux/" aria-label="Pinterest" target="_blank" rel="noopener noreferrer">
              <img src="OFF BACK/icons8-pinterest-50.png" alt="Pinterest">
            </a>
            <a href="https://www.tiktok.com/@benzyluxury_" aria-label="TikTok" target="_blank" rel="noopener noreferrer">
              <img src="OFF BACK/icons8-tiktok-50.png" alt="TikTok">
            </a>
            <a href="https://www.snapchat.com/@benzylux" aria-label="Snapchat" target="_blank" rel="noopener noreferrer">
              <img src="OFF BACK/icons8-snapchat-circled-logo-48.png" alt="Snapchat">
            </a>
          </div>
        </section>

        <nav class="bl-site-footer__links bl-site-footer__links--quick" aria-label="Footer quick links">
          <span class="bl-site-footer__kicker">Quick Link</span>
          <a href="index.html">Home</a>
          <a href="About.html">About</a>
          <a href="Contact.html">Contact</a>
          <a href="Contact.html#faq">FAQ</a>
          <a href="StorePolicies.html">Store Policies</a>
        </nav>

        <nav class="bl-site-footer__links bl-site-footer__links--shop" aria-label="Footer shop links">
          <span class="bl-site-footer__kicker">Shop</span>
          <a href="Shop.html?cat=all">Shop All</a>
        </nav>
      </div>

      <div class="bl-site-footer__bottom">
        <section class="bl-site-footer__info">
          <div class="bl-site-footer__hours">
            <span class="bl-site-footer__hours-label">Operating Hours</span>
            <span class="bl-site-footer__hours-line">Monday - Saturday (10AM - 8PM)</span>
            <span class="bl-site-footer__hours-line">Sunday (12PM - 8PM)</span>
          </div>
          <p class="bl-site-footer__address" data-site-contact-address>Babcock University Ilishan-Remo, Ogun State.</p>
          <a href="https://maps.app.goo.gl/YhKqWLZmk3PdCRTw9" class="bl-site-footer__directions" target="_blank" rel="noopener noreferrer">Get Directions</a>
        </section>
        
        <section class="bl-site-footer__newsletter">
          <span class="bl-site-footer__kicker" data-site-newsletter-title>Get 10% Off Your Next Order</span>
          <p data-site-newsletter-body>*By signing up, you agree to receive emails about Benzy Luxury and our <a href="StorePolicies.html">store policies</a>.</p>
          <form class="bl-site-footer__form" action="#" method="get" novalidate data-footer-subscribe>
            <input type="email" name="email" placeholder="Email" autocomplete="email" inputmode="email" maxlength="254" required aria-describedby="footer-subscribe-message">
            <button type="submit" aria-label="Submit email">&#8594;</button>
          </form>
          <p class="bl-site-footer__form-message" id="footer-subscribe-message" data-footer-subscribe-message aria-live="polite"></p>
        </section>
      </div>
    </div>
  `;

  document.body.appendChild(footer);
})();

(function () {
  const footerForm = document.querySelector("[data-footer-subscribe]");
  const emailInput = footerForm?.querySelector('input[name="email"]');
  const submitButton = footerForm?.querySelector('button[type="submit"]');
  const messageEl = document.querySelector("[data-footer-subscribe-message]");
  const submitButtonDefaultLabel = submitButton?.innerHTML || "&#8594;";
  const COUPON_KEY = "benzy_discount_coupon";
  const API_BASES = (() => {
    const bases = [];
    const origin = window.location.origin;
    const stored = readBenzyStoredApiBase();
    bases.push("https://benzy-luxury-website.onrender.com");
    if (stored && stored !== origin) bases.push(stored);
    return Array.from(new Set(bases));
  })();

  if (
    !(footerForm instanceof HTMLFormElement) ||
    !(emailInput instanceof HTMLInputElement) ||
    !(submitButton instanceof HTMLButtonElement) ||
    !(messageEl instanceof HTMLElement)
  ) {
    return;
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
  }

  function setFooterMessage(text, state) {
    messageEl.textContent = text || "";
    if (state) {
      messageEl.dataset.state = state;
    } else {
      delete messageEl.dataset.state;
    }
  }

  function saveCouponState(code, email) {
    if (!code) return;
    localStorage.setItem(
      COUPON_KEY,
      JSON.stringify({
        code: String(code).trim().toUpperCase(),
        status: "saved",
        email: normalizeEmail(email),
        source: "footer",
        discountPercent: 10,
        subscribedAt: new Date().toISOString()
      })
    );
  }

  function getAuthHeaders() {
    const token = localStorage.getItem("benzy_auth_token") || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function shouldReturnApiResponse(response, data) {
    if (!response) return false;
    if (response.ok) return true;
    if ([400, 401, 403, 409, 422].includes(response.status)) return true;
    if (data && typeof data.message === "string" && data.message.trim()) return true;
    return false;
  }

  async function submitSubscription(email) {
    for (const base of API_BASES) {
      try {
        const response = await fetch(`${base}/api/newsletter/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, source: "footer" })
        });
        const data = await response.json().catch(() => ({}));
        if (shouldReturnApiResponse(response, data)) {
          return { response, data };
        }
      } catch {
        // Try the next configured API base.
      }
    }

    throw new Error("Unable to reach subscription service.");
  }

  footerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = normalizeEmail(emailInput.value);
    if (!isValidEmail(email)) {
      emailInput.setAttribute("aria-invalid", "true");
      setFooterMessage("Enter a valid email address.", "error");
      emailInput.focus();
      return;
    }

    emailInput.removeAttribute("aria-invalid");
    submitButton.disabled = true;
    emailInput.disabled = true;
    footerForm.setAttribute("aria-busy", "true");
    submitButton.textContent = "...";
    setFooterMessage("Submitting...", "pending");

    try {
      const { response, data } = await submitSubscription(email);
      if (response.ok && data?.success) {
        saveCouponState(data.discountCode, email);
        footerForm.reset();
        setFooterMessage(
          String(data?.message || `Thanks for subscribing! Your 10% off code is: ${data?.discountCode || ""}`),
          "success"
        );
      } else {
        setFooterMessage(String(data?.message || "Unable to subscribe right now."), "error");
      }
    } catch {
      setFooterMessage("Unable to subscribe right now. Please try again.", "error");
    } finally {
      submitButton.disabled = false;
      emailInput.disabled = false;
      footerForm.removeAttribute("aria-busy");
      submitButton.innerHTML = submitButtonDefaultLabel;
    }
  });
})();

(function () {
  const page = window.location.pathname.toLowerCase();
  const isAdminPage = page.endsWith("/admin.html")
    || page.endsWith("admin.html")
    || page.endsWith("/admindashboard.html")
    || page.endsWith("admindashboard.html");
  const isProfilePage = page.endsWith("/profile.html") || page.endsWith("profile.html");
  if (isAdminPage || isProfilePage) return;

  const hasContentTargets = document.querySelector(
    "[data-site-footer-headline], [data-site-homepage-title], [data-site-hero-heading], [data-site-about-copy], [data-site-contact-address], [data-site-faq-grid], [data-site-policy-shipping]"
  );
  if (!hasContentTargets) return;

  const API_BASES = (() => {
    const bases = [];
    const origin = window.location.origin;
    const stored = readBenzyStoredApiBase();
    bases.push("https://benzy-luxury-website.onrender.com");
    if (stored && stored !== origin) bases.push(stored);
    return Array.from(new Set(bases));
  })();

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setText(selector, value) {
    const nextValue = String(value || "").trim();
    if (!nextValue) return;
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = nextValue;
    });
  }

  function setLinks(selector, href) {
    const nextHref = String(href || "").trim();
    if (!nextHref) return;
    document.querySelectorAll(selector).forEach((node) => {
      if (node instanceof HTMLAnchorElement) {
        node.setAttribute("href", nextHref);
      }
    });
  }

  function setParagraphBlocks(selector, value) {
    const nextValue = String(value || "").trim();
    if (!nextValue) return;

    const blocks = nextValue
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean);

    if (!blocks.length) return;
    document.querySelectorAll(selector).forEach((node) => {
      if (node.tagName === "P") {
        node.innerHTML = blocks.map((block) => escapeHtml(block)).join("<br><br>");
        return;
      }

      node.innerHTML = blocks.map((block) => `<p>${escapeHtml(block)}</p>`).join("");
    });
  }

  function bindFaqAccordion(root) {
    if (!(root instanceof HTMLElement)) return;
    const faqItems = root.querySelectorAll(".faq-item");

    faqItems.forEach((item) => {
      const question = item.querySelector(".faq-question");
      if (!(question instanceof HTMLButtonElement) || question.dataset.faqBound === "true") return;

      question.dataset.faqBound = "true";
      question.addEventListener("click", function () {
        faqItems.forEach((otherItem) => {
          if (otherItem !== item) otherItem.classList.remove("active");
        });
        item.classList.toggle("active");
      });
    });
  }

  function renderFaq(items) {
    const safeItems = Array.isArray(items) ? items : [];
    const faqMarkup = safeItems
      .map((item) => {
        const question = String(item && item.question || "").trim();
        const answer = String(item && item.answer || "").trim();
        if (!question || !answer) return "";
        return `
          <div class="faq-item">
            <button type="button" class="faq-question">${escapeHtml(question)}</button>
            <div class="faq-answer">
              <p>${escapeHtml(answer)}</p>
            </div>
          </div>
        `;
      })
      .join("");

    if (!faqMarkup) return;
    document.querySelectorAll("[data-site-faq-grid]").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.innerHTML = faqMarkup;
      bindFaqAccordion(node);
    });
  }

  const CONTACT_INFO_DEFAULTS = Object.freeze({
    email: "admin@benzyluxury.com",
    phone: "+234 701 154 7813",
    address: "Lagos, Nigeria"
  });
  const LEGACY_CONTACT_EMAILS = new Set(["hello@benzyluxury.com", "lilbenzyy@gmail.com"]);
  const LEGACY_CONTACT_PHONE_VALUES = new Set(["+2340000000000", "2340000000000"]);

  function normalizeContactPhoneValue(value) {
    return String(value || "").replace(/[^\d+]/g, "");
  }

  function resolveContactInfo(contactInfo) {
    const source = contactInfo && typeof contactInfo === "object" ? contactInfo : {};
    const rawEmail = String(source.email || "").trim();
    const rawPhone = String(source.phone || "").trim();
    const rawAddress = String(source.address || "").trim();

    return {
      email: rawEmail && !LEGACY_CONTACT_EMAILS.has(rawEmail.toLowerCase()) ? rawEmail : CONTACT_INFO_DEFAULTS.email,
      phone: rawPhone && !LEGACY_CONTACT_PHONE_VALUES.has(normalizeContactPhoneValue(rawPhone)) ? rawPhone : CONTACT_INFO_DEFAULTS.phone,
      address: rawAddress || CONTACT_INFO_DEFAULTS.address
    };
  }

  function applyContactInfo(contactInfo) {
    const resolved = resolveContactInfo(contactInfo);
    const email = resolved.email;
    const phone = resolved.phone;
    const address = resolved.address;

    setText("[data-site-contact-email]", email);
    setText("[data-site-contact-phone]", phone);
    setText("[data-site-contact-address]", address);

    if (email) {
      document.querySelectorAll("[data-site-contact-email-link]").forEach((node) => {
        if (node instanceof HTMLAnchorElement) {
          node.href = `mailto:${email}`;
        }
      });
    }

    if (phone) {
      const normalizedPhone = phone.replace(/\s+/g, "");
      document.querySelectorAll("[data-site-contact-phone-link]").forEach((node) => {
        if (node instanceof HTMLAnchorElement) {
          node.href = `tel:${normalizedPhone}`;
        }
      });
    }
  }

  function applySiteContent(content) {
    if (!content || typeof content !== "object") return;

    const homepageBanner = content.homepageBanner || {};
    const heroSection = content.heroSection || {};
    const footerContent = content.footerContent || {};
    const newsletterSection = content.newsletterSection || {};
    const policyPages = content.policyPages || {};

    setText("[data-site-homepage-eyebrow]", homepageBanner.eyebrow);
    setText("[data-site-homepage-title]", homepageBanner.title);
    setText("[data-site-homepage-subtitle]", homepageBanner.subtitle);
    setText("[data-site-homepage-cta-label]", homepageBanner.ctaLabel);
    setLinks("[data-site-homepage-cta-link]", homepageBanner.ctaUrl);

    setText("[data-site-hero-heading]", heroSection.heading);
    setText("[data-site-hero-body]", heroSection.body);
    setText("[data-site-about-copy]", content.aboutUs);

    setText("[data-site-footer-headline]", footerContent.headline);
    setText("[data-site-footer-summary]", footerContent.body);
    setText("[data-site-newsletter-title]", newsletterSection.title);
    setParagraphBlocks("[data-site-newsletter-body]", footerContent.newsletterNote || newsletterSection.body);

    applyContactInfo(content.contactInfo);
    renderFaq(content.faq);
    setParagraphBlocks("[data-site-policy-terms]", policyPages.terms);
    setParagraphBlocks("[data-site-policy-shipping]", policyPages.shipping);
    setParagraphBlocks("[data-site-policy-returns]", policyPages.returns);
    setParagraphBlocks("[data-site-policy-privacy]", policyPages.privacy);
  }

  async function fetchSiteContent() {
    for (const base of API_BASES) {
      try {
        const response = await fetch(`${base}/api/content`);
        if (!response.ok) continue;
        const data = await response.json().catch(() => null);
        if (data && data.content && typeof data.content === "object") {
          return data.content;
        }
      } catch {
        // Try the next configured API base.
      }
    }

    return null;
  }

  void fetchSiteContent().then((content) => {
    if (!content) return;
    window.__BENZY_SITE_CONTENT = content;
    applySiteContent(content);
  });
})();

(function () {
  const path = window.location.pathname.toLowerCase();
  const isLookbookPage = path.endsWith("/lookbook.html") || path.endsWith("lookbook.html");
  const RESIDENT_TOKEN_KEY = "benzy_auth_token";
  const ADMIN_TOKEN_KEY = "benzy_admin_auth_token";

  const navbars = document.querySelectorAll(".navbar");
  if (!navbars.length) return;

  function getAccountShortcutMeta() {
    const residentToken = localStorage.getItem(RESIDENT_TOKEN_KEY) || "";
    if (residentToken) {
      return {
        href: "Profile.html",
        label: "My Account",
        title: "Open your profile"
      };
    }

    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
    if (adminToken) {
      return {
        href: "AdminDashboard.html",
        label: "Host Dashboard",
        title: "Open host dashboard"
      };
    }

    return {
      href: "Account.html",
      label: "Account",
      title: "Open account access"
    };
  }

  function syncAccountShortcut(link) {
    if (!(link instanceof HTMLAnchorElement)) return;
    const meta = getAccountShortcutMeta();
    link.href = meta.href;
    link.setAttribute("aria-label", meta.label);
    link.setAttribute("title", meta.title);
    link.dataset.accountDestination = meta.href;
  }

  function refreshAccountShortcuts() {
    document.querySelectorAll(".navbar .account-link, .navbar .nav-account-link").forEach((link) => {
      syncAccountShortcut(link);
    });
  }

  function enhanceMobileCurrencyPicker(currencyInline) {
    if (!(currencyInline instanceof HTMLElement)) return;
    if (currencyInline.querySelector(".mobile-currency-picker")) return;

    const select = currencyInline.querySelector("select");
    if (!(select instanceof HTMLSelectElement)) return;

    const picker = document.createElement("div");
    picker.className = "mobile-currency-picker";
    picker.innerHTML = `
      <button type="button" class="mobile-currency-current" aria-expanded="false"></button>
      <div class="mobile-currency-options" hidden></div>
    `;

    const current = picker.querySelector(".mobile-currency-current");
    const optionsWrap = picker.querySelector(".mobile-currency-options");
    if (!(current instanceof HTMLButtonElement) || !(optionsWrap instanceof HTMLElement)) return;

    function syncPicker() {
      current.textContent = select.value || "NGN";
      optionsWrap.querySelectorAll("button[data-currency]").forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        button.classList.toggle("is-active", button.dataset.currency === select.value);
      });
    }

    Array.from(select.options).forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mobile-currency-option";
      button.dataset.currency = option.value;
      button.textContent = option.textContent || option.value;
      button.addEventListener("click", function () {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        picker.classList.remove("is-open");
        optionsWrap.hidden = true;
        current.setAttribute("aria-expanded", "false");
        syncPicker();
      });
      optionsWrap.appendChild(button);
    });

    current.addEventListener("click", function () {
      const isOpen = picker.classList.toggle("is-open");
      optionsWrap.hidden = !isOpen;
      current.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof Node) || picker.contains(target)) return;
      picker.classList.remove("is-open");
      optionsWrap.hidden = true;
      current.setAttribute("aria-expanded", "false");
    });

    select.addEventListener("change", syncPicker);
    window.addEventListener("benzy:currency-updated", syncPicker);
    currencyInline.appendChild(picker);
    syncPicker();
  }

  navbars.forEach((navbar) => {
    const navLinks = navbar.querySelector(".nav-links");
    const navRight = navbar.querySelector(".nav-right");
    if (!(navLinks instanceof HTMLElement) || !(navRight instanceof HTMLElement)) return;

    const homeLi = navLinks.querySelector('a[href="index.html"]')?.closest("li");
    const shopLi = navLinks.querySelector(".has-dropdown");
    const aboutLi = navLinks.querySelector('a[href="About.html"]')?.closest("li");
    const contactLi = navLinks.querySelector('a[href="Contact.html"]')?.closest("li");
    let searchLi = navLinks.querySelector('a[href="Search.html"]')?.closest("li");

    let lookbookLi = navLinks.querySelector('a[href="Lookbook.html"]')?.closest("li");
    if (!(lookbookLi instanceof HTMLLIElement)) {
      lookbookLi = document.createElement("li");
      lookbookLi.innerHTML = '<a href="Lookbook.html">Look book</a>';
    }

    const lookbookAnchor = lookbookLi.querySelector("a");
    if (lookbookAnchor instanceof HTMLAnchorElement) {
      lookbookAnchor.classList.toggle("active", isLookbookPage);
    }

    if (!(searchLi instanceof HTMLLIElement)) {
      searchLi = document.createElement("li");
      searchLi.className = "nav-search-item";
      searchLi.innerHTML = '<a href="Search.html">Search</a>';
    } else {
      searchLi.classList.add("nav-search-item");
    }

    navLinks.innerHTML = "";
    [homeLi, shopLi, searchLi, aboutLi, lookbookLi, contactLi].forEach((item) => {
      if (item instanceof HTMLLIElement) navLinks.appendChild(item);
    });

    if (!navRight.querySelector(".account-link")) {
      const accountLink = document.createElement("a");
      accountLink.className = "account-link";
      accountLink.innerHTML = '<img src="OFF BACK/icons8-account-50.png" alt="Account Icon">';
      navRight.prepend(accountLink);
    }

    syncAccountShortcut(navRight.querySelector(".account-link"));
  });

  document.querySelectorAll("body > .currency-inline, .cart-currency-stack .currency-inline, .checkout-page-tools .currency-inline").forEach((currencyInline) => {
    enhanceMobileCurrencyPicker(currencyInline);
  });

  window.addEventListener("benzy:auth-login", refreshAccountShortcuts);
  window.addEventListener("benzy:auth-logout", refreshAccountShortcuts);
  window.addEventListener("storage", function (event) {
    if (event.key && ![RESIDENT_TOKEN_KEY, ADMIN_TOKEN_KEY].includes(event.key)) return;
    refreshAccountShortcuts();
  });
})();

(function () {
  try {
  const path = window.location.pathname.toLowerCase();
  const isAboutPage = path.endsWith("/about.html") || path.endsWith("about.html");
  const isLookbookPage = path.endsWith("/lookbook.html") || path.endsWith("lookbook.html");
  const isShopPage = path.endsWith("/shop.html") || path.endsWith("shop.html");
  if (!isAboutPage && !isLookbookPage && !isShopPage) return;
  if (document.querySelector(".chat-widget")) return;

  const widget = document.createElement("div");
  widget.className = "chat-widget";
  widget.innerHTML = `
    <button type="button" class="chat-with-us-float" aria-label="Chat with us" aria-expanded="false">
      <img src="OFF BACK/icons8-whatsapp-50.png" class="chat-trigger-icon" alt="" aria-hidden="true">
      <span class="chat-trigger-label">Chat with us</span>
      <i class="chat-with-us-dot" aria-hidden="true"></i>
    </button>
    <section class="chat-widget-popup" hidden aria-label="Chat popup">
      <div class="chat-widget-head">
        <div>
          <h4>Hi There</h4>
          <p>Welcome Guest</p>
        </div>
        <button type="button" class="chat-widget-close" aria-label="Close chat">&times;</button>
      </div>
      <div class="chat-widget-subhead">We typically reply within minutes</div>
      <div class="chat-widget-body">
        <img src="OFF BACK/Benzy Lux Logo 2 white.png" class="chat-widget-badge" alt="" aria-hidden="true">
        <div class="chat-widget-message">
          Welcome to BLX Support &#128075;<br>
          For order updates, kindly share your order number.<br>
          For anything else, drop us a message and we'll assist you.
        </div>
      </div>
      <form class="chat-widget-input-row">
        <input id="chat-widget-message" name="chat-message" type="text" class="chat-widget-input" placeholder="Send a message" autocomplete="off" />
        <div class="chat-widget-actions">
          <button type="button" class="chat-widget-emoji" aria-label="Emoji">&#128578;</button>
          <button type="submit" class="chat-widget-send" aria-label="Send message">&#10148;</button>
        </div>
        <div class="chat-emoji-panel" hidden aria-label="Emoji picker"></div>
      </form>
    </section>
    <button type="button" class="chat-widget-fab-close" aria-label="Close chat popup" hidden>&times;</button>
    <a class="chat-widget-wa-link" href="https://wa.me/" target="_blank" rel="noopener noreferrer" hidden></a>
  `;

  document.body.appendChild(widget);

  const toggleBtn = widget.querySelector(".chat-with-us-float");
  const popup = widget.querySelector(".chat-widget-popup");
  const closeBtn = widget.querySelector(".chat-widget-close");
  const fabClose = widget.querySelector(".chat-widget-fab-close");
  const form = widget.querySelector(".chat-widget-input-row");
  const input = widget.querySelector(".chat-widget-input");
  const waLink = widget.querySelector(".chat-widget-wa-link");
  const emojiBtn = widget.querySelector(".chat-widget-emoji");
  const emojiPanel = widget.querySelector(".chat-emoji-panel");
  const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  let triggerArmed = false;
  let armTimer = 0;

  if (!(toggleBtn instanceof HTMLButtonElement)) return;
  if (!(popup instanceof HTMLElement)) return;
  if (!(closeBtn instanceof HTMLButtonElement)) return;
  if (!(fabClose instanceof HTMLButtonElement)) return;
  if (!(form instanceof HTMLFormElement)) return;
  if (!(input instanceof HTMLInputElement)) return;
  if (!(waLink instanceof HTMLAnchorElement)) return;
  if (!(emojiBtn instanceof HTMLButtonElement)) return;
  if (!(emojiPanel instanceof HTMLElement)) return;

  const emojiCategories = [
    { id: "smileys", label: "Smileys", icon: "\u{1F642}", ranges: [[0x1F600, 0x1F64F]] },
    { id: "all", label: "All", icon: "\u{1F9E9}", ranges: [] },
    { id: "people", label: "People", icon: "\u{1F44D}", ranges: [[0x1F466, 0x1F487], [0x1F90F, 0x1F9AF]] },
    { id: "nature", label: "Nature", icon: "\u{1F331}", ranges: [[0x1F330, 0x1F43E], [0x1F980, 0x1F9A2]] },
    { id: "travel", label: "Travel", icon: "\u{1F697}", ranges: [[0x1F680, 0x1F6FF]] },
    { id: "objects", label: "Objects", icon: "\u{1F4A1}", ranges: [[0x1F4A0, 0x1F4FF], [0x1F9F0, 0x1F9FF]] },
    { id: "symbols", label: "Symbols", icon: "\u{2764}", ranges: [[0x2600, 0x26FF], [0x2700, 0x27BF]] }
  ];

  const isEmoji = (() => {
    try {
      return (char) => /\p{Extended_Pictographic}/u.test(char);
    } catch (_e) {
      return () => true;
    }
  })();

  function buildCategoryEmojis(ranges) {
    const list = [];
    for (const [start, end] of ranges) {
      for (let cp = start; cp <= end; cp += 1) {
        const char = String.fromCodePoint(cp);
        if (!isEmoji(char)) continue;
        list.push(char);
      }
    }
    return list;
  }

  const emojiByCategory = {};
  emojiCategories.filter((cat) => cat.id !== "all").forEach((cat) => {
    emojiByCategory[cat.id] = buildCategoryEmojis(cat.ranges);
  });
  emojiByCategory.all = [...new Set(Object.values(emojiByCategory).flat())];

  let activeEmojiCategory = "smileys";

  emojiPanel.innerHTML = `
    <div class="chat-emoji-tabs">
      ${emojiCategories
        .map(
          (cat) =>
            `<button type="button" class="chat-emoji-tab" data-emoji-tab="${cat.id}" aria-label="${cat.label}">${cat.icon}</button>`
        )
        .join("")}
    </div>
    <div class="chat-emoji-grid"></div>
  `;

  const emojiGrid = emojiPanel.querySelector(".chat-emoji-grid");
  if (!(emojiGrid instanceof HTMLElement)) return;

  function renderEmojiCategory(catId) {
    activeEmojiCategory = catId;
    const emojis = emojiByCategory[catId] || [];
    emojiGrid.innerHTML = emojis
      .map((emoji) => `<button type="button" class="chat-emoji-item" data-emoji="${emoji}" aria-label="${emoji}">${emoji}</button>`)
      .join("");
    emojiPanel.querySelectorAll(".chat-emoji-tab").forEach((tab) => {
      if (!(tab instanceof HTMLButtonElement)) return;
      tab.classList.toggle("is-active", tab.getAttribute("data-emoji-tab") === catId);
    });
  }

  function closeEmojiPanel() {
    emojiPanel.hidden = true;
  }

  function openPopup() {
    widget.classList.add("is-open");
    widget.classList.remove("is-peek");
    popup.hidden = false;
    fabClose.hidden = false;
    toggleBtn.setAttribute("aria-expanded", "true");
  }

  function closePopup() {
    widget.classList.remove("is-open");
    popup.hidden = true;
    fabClose.hidden = true;
    toggleBtn.setAttribute("aria-expanded", "false");
    closeEmojiPanel();
  }

  toggleBtn.addEventListener("click", function () {
    if (isTouchDevice && !widget.classList.contains("is-open") && !triggerArmed) {
      widget.classList.add("is-peek");
      triggerArmed = true;
      if (armTimer) window.clearTimeout(armTimer);
      armTimer = window.setTimeout(function () {
        triggerArmed = false;
        if (!widget.classList.contains("is-open")) widget.classList.remove("is-peek");
      }, 1800);
      return;
    }
    if (widget.classList.contains("is-open")) closePopup();
    else openPopup();
  });

  closeBtn.addEventListener("click", closePopup);
  fabClose.addEventListener("click", closePopup);

  emojiBtn.addEventListener("click", function () {
    emojiPanel.hidden = !emojiPanel.hidden;
    if (!emojiPanel.hidden && !emojiGrid.childElementCount) renderEmojiCategory(activeEmojiCategory);
  });

  emojiPanel.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const tab = target.closest(".chat-emoji-tab");
    if (tab instanceof HTMLButtonElement) {
      const catId = tab.getAttribute("data-emoji-tab");
      if (catId) renderEmojiCategory(catId);
      return;
    }
    const btn = target.closest(".chat-emoji-item");
    if (!(btn instanceof HTMLButtonElement)) return;
    const emoji = btn.getAttribute("data-emoji") || "";
    if (!emoji) return;
    input.value += emoji;
    input.focus();
    closeEmojiPanel();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const msg = input.value.trim();
    const base = "https://wa.me/2347011547813";
    const url = new URL(base);
    if (msg) url.searchParams.set("text", msg);
    waLink.href = url.toString();
    waLink.click();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closePopup();
  });

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (widget.contains(target)) {
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest(".chat-widget-emoji") && !target.closest(".chat-emoji-panel")) {
        closeEmojiPanel();
      }
      return;
    }
    closePopup();
  });
  } catch (_error) {
    // Keep the rest of the page functional even if chat widget fails.
  }
})();

(function () {
  const dropdowns = document.querySelectorAll(".has-dropdown");
  const onShopPage = window.location.pathname.toLowerCase().includes("shop.html");

  dropdowns.forEach((dropItem) => {
    const dropToggle = dropItem.querySelector(".shop-toggle");
    if (!dropToggle) return;
    const dropdown = dropItem.querySelector(".dropdown");

    if (dropdown && !dropdown.querySelector(".submenu-back-item")) {
      const backItem = document.createElement("li");
      backItem.className = "submenu-back-item";
      backItem.innerHTML = '<button type="button" class="submenu-back-btn" aria-label="Back to main menu">< Shop</button>';
      dropdown.prepend(backItem);
    }

    dropToggle.addEventListener("click", function (e) {
      const isMobileMenu = window.matchMedia("(max-width: 768px)").matches;
        if (isMobileMenu) {
          e.preventDefault();
          const nav = dropItem.closest("nav");
          dropItem.classList.toggle("open");
          if (nav) nav.classList.remove("submenu-open");
          return;
        }

      if (onShopPage) {
        e.preventDefault();
        dropItem.classList.toggle("open");
        return;
      }

      const isMobile = window.matchMedia("(max-width: 992px)").matches;
      if (!isMobile) return;

      const isOpen = dropItem.classList.contains("open");
      if (!isOpen) {
        e.preventDefault();
        dropItem.classList.add("open");
      }
    });

    if (dropdown) {
      dropdown.addEventListener("click", function (e) {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.closest(".submenu-back-btn")) return;
        e.preventDefault();
        dropItem.classList.remove("open");
        const nav = dropItem.closest("nav");
        if (nav) nav.classList.remove("submenu-open");
      });
    }
  });

  document.addEventListener("click", function (e) {
    dropdowns.forEach((dropItem) => {
      if (!dropItem.contains(e.target)) {
        dropItem.classList.remove("open");
      }
    });
  });
})();

(function () {
  const splitCards = document.querySelectorAll(".shop-home-split-card[data-hover-image]");
  if (!splitCards.length) return;

  splitCards.forEach((card) => {
    const baseImage = card.getAttribute("data-base-image") || "";
    const hoverImage = card.getAttribute("data-hover-image") || "";
    if (!baseImage || !hoverImage) return;

    const baseBg = `url('${baseImage}')`;
    const hoverBg = `url('${hoverImage}')`;

    card.style.backgroundImage = baseBg;

    function setBase() {
      card.style.backgroundImage = baseBg;
    }

    function setHover() {
      card.style.backgroundImage = hoverBg;
    }

    card.addEventListener("mouseenter", setHover);
    card.addEventListener("mouseleave", setBase);
    card.addEventListener("focusin", setHover);
    card.addEventListener("focusout", setBase);
    card.addEventListener("touchstart", setHover, { passive: true });
    card.addEventListener(
      "touchend",
      function () {
        window.setTimeout(setBase, 280);
      },
      { passive: true }
    );
  });
})();

(function () {
  const navbars = document.querySelectorAll(".navbar");
  if (!navbars.length) return;

  navbars.forEach((navbar) => {
    const nav = navbar.querySelector("nav");
    const navLinks = navbar.querySelector(".nav-links");
    if (!nav || !navLinks) return;

    let toggleBtn = navbar.querySelector(".nav-menu-toggle");
    if (!toggleBtn) {
      toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "nav-menu-toggle";
      toggleBtn.setAttribute("aria-label", "Toggle menu");
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.innerHTML = "<span></span><span></span><span></span>";
      const logo = navbar.querySelector(".logo");
      if (logo) navbar.insertBefore(toggleBtn, logo);
      else navbar.insertBefore(toggleBtn, navbar.firstChild);
    }

    // Keep stable DOM order for mobile layout: toggle (left), logo (center), icons (right)
    const logo = navbar.querySelector(".logo");
    if (logo && toggleBtn.nextElementSibling !== logo) {
      navbar.insertBefore(toggleBtn, logo);
    }

    function closeMenu() {
      navbar.classList.remove("is-mobile-open");
      toggleBtn.setAttribute("aria-expanded", "false");
      if (nav) nav.classList.remove("submenu-open");
      navbar.querySelectorAll(".has-dropdown.open").forEach((item) => item.classList.remove("open"));
    }

    function openMenu() {
      navbar.classList.add("is-mobile-open");
      toggleBtn.setAttribute("aria-expanded", "true");
    }

    toggleBtn.addEventListener("click", function () {
      const isOpen = navbar.classList.contains("is-mobile-open");
      if (isOpen) closeMenu();
      else openMenu();
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", function (event) {
        if (!window.matchMedia("(max-width: 768px)").matches) return;
        if (event.defaultPrevented) return;

        const isShopToggle = link.classList.contains("shop-toggle");
        if (isShopToggle) {
          event.preventDefault();
          const drop = link.closest(".has-dropdown");
          if (drop) drop.classList.toggle("open");
          return;
        }

        closeMenu();
      });
    });

    document.addEventListener("click", function (event) {
      if (!window.matchMedia("(max-width: 768px)").matches) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!navbar.contains(target)) closeMenu();
    });

    window.addEventListener("resize", function () {
      if (!window.matchMedia("(max-width: 768px)").matches) closeMenu();
    });
  });
})();

(function () {
  const logoTargets = document.querySelectorAll(".logo, .logo-main, .logo-blx");
  if (!logoTargets.length) return;

  logoTargets.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.style.cursor = "pointer";
    el.addEventListener("click", function () {
      window.location.href = "Shop.html";
    });
    el.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = "Shop.html";
      }
    });
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  });
})();

(function () {
  if (!document.body.classList.contains("shop-page-nav")) return;
  const navbar = document.querySelector(".navbar");
  if (!(navbar instanceof HTMLElement)) return;

  let timerId = null;

  function pulseNav() {
    navbar.classList.add("is-nav-active");
    if (timerId) window.clearTimeout(timerId);
    timerId = window.setTimeout(function () {
      navbar.classList.remove("is-nav-active");
    }, 900);
  }

  function getScrollTop() {
    const doc = document.scrollingElement || document.documentElement || document.body;
    const winY = typeof window.scrollY === "number" ? window.scrollY : 0;
    const docY = doc && typeof doc.scrollTop === "number" ? doc.scrollTop : 0;
    const bodyY = document.body && typeof document.body.scrollTop === "number" ? document.body.scrollTop : 0;
    return Math.max(0, winY, docY, bodyY);
  }

  function syncShopNavOnScroll() {
    const y = getScrollTop();
    if (y > 0) navbar.classList.add("is-nav-scrolled");
    else navbar.classList.remove("is-nav-scrolled");
  }

  navbar.addEventListener("touchstart", pulseNav, { passive: true });
  navbar.addEventListener("pointerdown", pulseNav);
  window.addEventListener("scroll", syncShopNavOnScroll, { passive: true });
  document.addEventListener("scroll", syncShopNavOnScroll, { passive: true, capture: true });
  syncShopNavOnScroll();

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (navbar.contains(target)) return;
    navbar.classList.remove("is-nav-active");
  });
})();

(function () {
  const heroVideo = document.querySelector(".video-bg");
  if (!(heroVideo instanceof HTMLVideoElement)) return;

  function tryPlayVideo() {
    heroVideo.muted = true;
    heroVideo.setAttribute("muted", "");
    heroVideo.setAttribute("playsinline", "");
    const promise = heroVideo.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(function () {
        // Some mobile browsers delay autoplay until first interaction.
      });
    }
  }

  heroVideo.addEventListener("loadeddata", tryPlayVideo);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") tryPlayVideo();
  });

  document.addEventListener("touchstart", function onFirstTouch() {
    tryPlayVideo();
    document.removeEventListener("touchstart", onFirstTouch);
  }, { passive: true });
})();

(function () {
  document.querySelectorAll(
    ".navbar .nav-currency, .navbar .currency-inline, .navbar #currency-select, .navbar #global-currency-select"
  ).forEach((el) => {
    const container = el.closest("label, .nav-currency") || el;
    if (container && container.parentNode) container.parentNode.removeChild(container);
  });
})();

(function () {
  const toggles = document.querySelectorAll(".filter-toggle");
  if (!toggles.length) return;

  toggles.forEach((toggle) => {
    const key = toggle.getAttribute("data-filter-target");
    if (!key) return;
    const body = document.querySelector(`[data-filter-body="${key}"]`);
    const icon = toggle.querySelector(".filter-chevron");
    if (!body) return;

    const isExpanded = toggle.getAttribute("aria-expanded") !== "false";
    if (!isExpanded) body.setAttribute("hidden", "");
    if (icon) icon.textContent = isExpanded ? "\u2212" : "+";

    toggle.addEventListener("click", function () {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      const next = !expanded;
      toggle.setAttribute("aria-expanded", next ? "true" : "false");
      if (next) body.removeAttribute("hidden");
      else body.setAttribute("hidden", "");
      if (icon) icon.textContent = next ? "\u2212" : "+";
    });
  });
})();

(function () {
  const page = document.getElementById("admin-page");
  const list = document.getElementById("admin-list");
  const resetBtn = document.getElementById("admin-reset");
  if (!page || !list) return;
  const TOKEN_KEY = "benzy_admin_auth_token";
  const LOGIN_INTENT_KEY = "benzy_login_intent";
  const storedApiBase = readBenzyStoredApiBase();
  const API_BASE = storedApiBase && storedApiBase !== window.location.origin
    ? storedApiBase
    : "https://benzy-luxury-website.onrender.com";
  const LEGACY_ADMIN_EMAILS = ["admin@benzyluxury.com"];
  const ACCOUNT_KEY_PREFIX = "benzy_account_";
  const ACCOUNT_ORDERS_SUFFIX = "_orders";
  const ORDER_STATUSES = ["Placed", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
  const SHIPPING_FEE_KEY = "benzy_shipping_fee_ngn";
  const ordersWrap = document.createElement("section");
  ordersWrap.className = "admin-shell";
  ordersWrap.innerHTML = `
    <div class="admin-head">
      <h1>Resident Orders</h1>
      <p>Manage resident order status updates from one place.</p>
    </div>
    <div id="admin-orders-list" class="admin-list"></div>
  `;
  page.appendChild(ordersWrap);
  // Default to Products view on load; Orders are shown only when the tab is selected.
  ordersWrap.style.display = "none";
  const ordersList = ordersWrap.querySelector("#admin-orders-list");
  const usersWrap = document.createElement("section");
  usersWrap.className = "admin-shell admin-users-shell";
  usersWrap.innerHTML = `
    <div class="admin-head admin-head-row">
      <div>
        <h1>Users</h1>
        <p>View and manage registered accounts.</p>
      </div>
      <button class="admin-action" id="admin-users-refresh" type="button">Refresh</button>
    </div>
    <p class="admin-empty" id="admin-users-status">No users loaded yet.</p>
    <div id="admin-users-list" class="admin-users-list"></div>
  `;
  page.appendChild(usersWrap);
  usersWrap.style.display = "none";
  const usersList = usersWrap.querySelector("#admin-users-list");
  const usersStatus = usersWrap.querySelector("#admin-users-status");
  const usersRefreshBtn = usersWrap.querySelector("#admin-users-refresh");

  function isHostUser(user) {
    const role = String(user?.role || "").trim().toLowerCase();
    if (role === "host") return true;
    const email = String(user?.email || "").trim().toLowerCase();
    return LEGACY_ADMIN_EMAILS.includes(email);
  }

  function redirectToHostLogin() {
    localStorage.setItem(LOGIN_INTENT_KEY, "host");
    window.location.href = "Admin.html";
  }

  function getShippingFeeNgn() {
    const raw = parseFloat(localStorage.getItem(SHIPPING_FEE_KEY) || "0");
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return raw;
  }

  function saveShippingFeeNgn(value) {
    const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
    localStorage.setItem(SHIPPING_FEE_KEY, String(safeValue));
  }

  async function fetchShippingFeeFromApi() {
    try {
      const response = await fetch(`${API_BASE}/api/settings/shipping`);
      const data = await response.json().catch(() => null);
      if (!response.ok) return null;
      const fee = Number(data?.shippingFeeNgn);
      if (!Number.isFinite(fee) || fee < 0) return null;
      return fee;
    } catch {
      return null;
    }
  }

  async function saveShippingFeeToApi(value) {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) throw new Error("Missing admin token.");
    const response = await fetch(`${API_BASE}/api/settings/shipping`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ shippingFeeNgn: value })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Unable to update shipping fee.");
    }
    const fee = Number(data?.shippingFeeNgn);
    if (Number.isFinite(fee) && fee >= 0) return fee;
    return value;
  }

  async function hydrateShippingFeeInput() {
    const input = list.querySelector(".admin-shipping-fee");
    if (!(input instanceof HTMLInputElement)) return;
    const fee = await fetchShippingFeeFromApi();
    if (Number.isFinite(fee) && fee >= 0) {
      saveShippingFeeNgn(fee);
      input.value = String(fee);
    }
  }

  function renderAdmin() {
    const overrides = loadProductOverrides();
    const sortedProducts = [...BENZY_PRODUCTS].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    const shippingFee = getShippingFeeNgn();
    const settingsCard = `
      <article class="admin-card admin-settings-card">
        <img src="OFF BACK/BLX.png" alt="Shipping settings">
        <div class="admin-fields">
          <h3>Shipping Fee (NGN)</h3>
          <p>Set the flat shipping fee used at checkout.</p>
          <label>Amount (NGN)
            <input class="admin-shipping-fee" type="number" min="0" step="100" value="${shippingFee}">
          </label>
          <button class="admin-save admin-shipping-save" type="button">Save Shipping</button>
        </div>
      </article>
    `;
    list.innerHTML = settingsCard + sortedProducts.map((product) => {
      const ov = overrides[String(product.id)] || {};
      const color = getProductColorInfo(product);
      const inStock = typeof ov.inStock === "boolean" ? ov.inStock : product.inStock !== false;
      const colorLabel = ov.colorLabel || color.label || "";
      const colorHex = ov.colorHex || color.hex || "#d0d0d0";
      const colorBorder = ov.colorBorder || color.border || "#9e9e9e";

      return `
        <article class="admin-card" data-product-id="${product.id}">
          <img src="${product.images?.[0] || ""}" alt="${product.name}">
          <div class="admin-fields">
            <h3>${product.name}</h3>
            <p>#${getProductSku(product)}</p>
            <label><input class="admin-instock" type="checkbox" ${inStock ? "checked" : ""}> In stock</label>
            <label>Color name <input class="admin-color-label" type="text" value="${String(colorLabel).replaceAll('"', "&quot;")}"></label>
            <label>Color hex <input class="admin-color-hex" type="text" value="${String(colorHex).replaceAll('"', "&quot;")}"></label>
            <label>Border hex <input class="admin-color-border" type="text" value="${String(colorBorder).replaceAll('"', "&quot;")}"></label>
            <button class="admin-save" type="button">Save</button>
          </div>
        </article>
      `;
    }).join("");
    updateStatsCards();
    hydrateShippingFeeInput();
  }

  function updateStatsCards() {
    const statProducts = document.getElementById("stat-products");
    const statOrders = document.getElementById("stat-orders");
    const statPending = document.getElementById("stat-pending");
    const statShipped = document.getElementById("stat-shipped");
    
    if (statProducts) statProducts.textContent = String(BENZY_PRODUCTS.length);
    
    const buckets = loadAllOrderBuckets();
    const allOrders = buckets.flatMap((b) => b.orders);
    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter((o) => String(o?.status || "Pending") === "Pending").length;
    const shippedOrders = allOrders.filter((o) => String(o?.status || "") === "Shipped").length;
    
    if (statOrders) statOrders.textContent = String(totalOrders);
    if (statPending) statPending.textContent = String(pendingOrders);
    if (statShipped) statShipped.textContent = String(shippedOrders);
  }

  function loadAllOrderBuckets() {
    const buckets = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.startsWith(ACCOUNT_KEY_PREFIX) || !key.endsWith(ACCOUNT_ORDERS_SUFFIX)) continue;
      const userKey = key.slice(ACCOUNT_KEY_PREFIX.length, key.length - ACCOUNT_ORDERS_SUFFIX.length);
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(parsed)) continue;
        buckets.push({ key, userKey, orders: parsed });
      } catch {
        // Skip invalid data.
      }
    }
    return buckets;
  }

  function renderAdminOrders() {
    if (!(ordersList instanceof HTMLElement)) return;
    const buckets = loadAllOrderBuckets();
    const entries = buckets.flatMap((bucket) =>
      bucket.orders.map((order) => ({
        storageKey: bucket.key,
        userKey: bucket.userKey,
        order
      }))
    );

    entries.sort((a, b) => {
      const da = String(a?.order?.date || "");
      const db = String(b?.order?.date || "");
      return db.localeCompare(da);
    });

    if (!entries.length) {
      ordersList.innerHTML = '<p class="admin-empty">No orders found yet.</p>';
      return;
    }

    ordersList.innerHTML = entries
      .map(({ storageKey, userKey, order }) => {
        const orderId = String(order?.id || "");
        const status = String(order?.status || "Pending");
        const qty = Math.max(1, parseInt(String(order?.qty || 1), 10));
        const total = Number(order?.total || 0);
        const orderCurrency = String(order?.currency || "USD").toUpperCase();
        const customer = String(order?.customerEmail || "").trim() || userKey.replaceAll("_", ".");
        return `
          <article class="admin-card" data-order-id="${orderId}" data-order-key="${storageKey}">
            <div class="admin-fields">
              <h3>${orderId || "Order"}</h3>
              <p>Customer: ${customer}</p>
              <p>Date: ${String(order?.date || "-")} | Qty: ${qty}</p>
              <p>Total: ${formatCurrencyByCode(total, orderCurrency)}</p>
              <label>
                Status
                <select class="admin-order-status">
                  ${ORDER_STATUSES.map((item) => `<option value="${item}" ${item === status ? "selected" : ""}>${item}</option>`).join("")}
                </select>
              </label>
              <button class="admin-save admin-order-save" type="button">Save Status</button>
            </div>
          </article>
        `;
      })
      .join("");
    updateStatsCards();
  }

  async function fetchAdminUsers() {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) throw new Error("Missing admin token.");
    const response = await fetch(`${API_BASE}/api/admin/users`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Unable to load users.");
    }
    return Array.isArray(data?.users) ? data.users : [];
  }

  function formatUserDate(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch {
      return String(value);
    }
  }

  function renderAdminUsers(users) {
    if (!(usersList instanceof HTMLElement)) return;
    if (usersStatus) usersStatus.style.display = "none";
    const safeUsers = Array.isArray(users) ? users : [];
    if (!safeUsers.length) {
      if (usersStatus) {
        usersStatus.textContent = "No users found.";
        usersStatus.style.display = "block";
      }
      usersList.innerHTML = "";
      return;
    }
    usersList.innerHTML = safeUsers
      .map((user) => {
        const role = String(user?.role || "resident");
        const phone = String(user?.phone || "").trim() || "—";
        const created = formatUserDate(user?.createdAt);
        const addressesCount = Number(user?.addressesCount || 0);
        return `
          <article class="admin-user-card" data-user-id="${user?.id}">
            <div class="admin-user-main">
              <div>
                <h3>${String(user?.name || "User")}</h3>
                <p class="admin-user-email">${String(user?.email || "")}</p>
              </div>
              <span class="admin-user-pill ${role === "host" ? "admin-user-pill-host" : ""}">${role}</span>
            </div>
            <div class="admin-user-meta">
              <span>Phone: ${phone}</span>
              <span>Joined: ${created}</span>
              <span>Addresses: ${addressesCount}</span>
            </div>
            <div class="admin-user-actions">
              <button class="admin-user-delete" type="button" data-user-id="${user?.id}">Delete</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadAdminUsers() {
    if (usersStatus) {
      usersStatus.textContent = "Loading users...";
      usersStatus.style.display = "block";
    }
    try {
      const users = await fetchAdminUsers();
      renderAdminUsers(users);
    } catch (error) {
      if (usersStatus) {
        usersStatus.textContent = error.message || "Unable to load users.";
        usersStatus.style.display = "block";
      }
      if (usersList) usersList.innerHTML = "";
    }
  }

  async function deleteAdminUser(userId) {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) throw new Error("Missing admin token.");
    const response = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Unable to delete user.");
    }
    return data;
  }

  function bindAdminHandlers() {
    list.addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const saveBtn = target.closest(".admin-save");
      if (!saveBtn) return;

      const card = saveBtn.closest(".admin-card");
      if (!card) return;
      if (saveBtn.classList.contains("admin-shipping-save")) {
        const shippingInput = card.querySelector(".admin-shipping-fee");
        if (!(shippingInput instanceof HTMLInputElement)) return;
        const value = parseFloat(shippingInput.value);
        if (!Number.isFinite(value) || value < 0) {
          shippingInput.value = String(getShippingFeeNgn());
          return;
        }
        saveBtn.textContent = "Saving...";
        saveShippingFeeToApi(value)
          .then((fee) => {
            saveShippingFeeNgn(fee);
            shippingInput.value = String(fee);
            saveBtn.textContent = "Saved";
            window.setTimeout(function () {
              saveBtn.textContent = "Save Shipping";
            }, 800);
          })
          .catch(() => {
            saveShippingFeeNgn(value);
            saveBtn.textContent = "Saved";
            window.setTimeout(function () {
              saveBtn.textContent = "Save Shipping";
            }, 800);
          });
        return;
      }
      const id = card.getAttribute("data-product-id");
      if (!id) return;

      const inStockEl = card.querySelector(".admin-instock");
      const colorLabelEl = card.querySelector(".admin-color-label");
      const colorHexEl = card.querySelector(".admin-color-hex");
      const colorBorderEl = card.querySelector(".admin-color-border");
      if (!(inStockEl instanceof HTMLInputElement)) return;
      if (!(colorLabelEl instanceof HTMLInputElement)) return;
      if (!(colorHexEl instanceof HTMLInputElement)) return;
      if (!(colorBorderEl instanceof HTMLInputElement)) return;

      const next = loadProductOverrides();
      next[String(id)] = {
        inStock: inStockEl.checked,
        colorLabel: colorLabelEl.value.trim(),
        colorHex: colorHexEl.value.trim(),
        colorBorder: colorBorderEl.value.trim()
      };

      saveProductOverrides(next);
      saveBtn.textContent = "Saved";
      window.setTimeout(function () {
        saveBtn.textContent = "Save";
      }, 800);
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        saveProductOverrides({});
        localStorage.removeItem(SHIPPING_FEE_KEY);
        saveShippingFeeToApi(0).catch(() => {});
        renderAdmin();
      });
    }

    if (ordersList instanceof HTMLElement) {
      ordersList.addEventListener("click", function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const saveBtn = target.closest(".admin-order-save");
        if (!(saveBtn instanceof HTMLButtonElement)) return;

        const card = saveBtn.closest(".admin-card");
        if (!(card instanceof HTMLElement)) return;
        const storageKey = card.getAttribute("data-order-key") || "";
        const orderId = card.getAttribute("data-order-id") || "";
        const statusInput = card.querySelector(".admin-order-status");
        if (!(statusInput instanceof HTMLSelectElement)) return;

        try {
          const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
          const list = Array.isArray(parsed) ? parsed : [];
          const next = list.map((order) => {
            if (String(order?.id || "") !== orderId) return order;
            return { ...order, status: statusInput.value };
          });
          localStorage.setItem(storageKey, JSON.stringify(next));
          saveBtn.textContent = "Saved";
          window.setTimeout(function () {
            saveBtn.textContent = "Save Status";
          }, 900);
          renderAdminOrders();
        } catch {
          saveBtn.textContent = "Failed";
          window.setTimeout(function () {
            saveBtn.textContent = "Save Status";
          }, 900);
        }
      });
    }

    if (usersRefreshBtn instanceof HTMLButtonElement) {
      usersRefreshBtn.addEventListener("click", function () {
        loadAdminUsers();
      });
    }

    if (usersList instanceof HTMLElement) {
      usersList.addEventListener("click", async function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const deleteBtn = target.closest(".admin-user-delete");
        if (!(deleteBtn instanceof HTMLButtonElement)) return;
        const userId = deleteBtn.getAttribute("data-user-id") || "";
        if (!userId) return;
        if (!window.confirm("Delete this user? This cannot be undone.")) return;

        deleteBtn.disabled = true;
        deleteBtn.textContent = "Deleting...";
        try {
          await deleteAdminUser(userId);
          await loadAdminUsers();
        } catch (error) {
          deleteBtn.textContent = "Failed";
          window.setTimeout(function () {
            deleteBtn.textContent = "Delete";
            deleteBtn.disabled = false;
          }, 1000);
        }
      });
    }

    window.addEventListener("benzy:product-overrides-updated", renderAdmin);
    window.addEventListener("storage", function () {
      renderAdminOrders();
    });
  }

  async function initAdminAccess() {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) {
      redirectToHostLogin();
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json().catch(function () {
        return null;
      });
      if (!response.ok) throw new Error(data?.error || "Unauthorized.");
      if (!isHostUser(data?.user || {})) throw new Error("Host access is only for admin.");
      bindAdminHandlers();
      renderAdmin();
      renderAdminOrders();
      loadAdminUsers();
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      redirectToHostLogin();
    }
  }

  initAdminAccess();

  // Ensure browser back from admin dashboard redirects to Account immediately.
  (function setupAdminBackRedirect() {
    if (!page) return;
    const ACCOUNT_PAGE_URL = "Account.html";
    try {
      history.pushState({ adminDashboard: true }, "", window.location.href);
    } catch {
      // Ignore history errors.
    }
    window.addEventListener("popstate", function () {
      window.location.href = ACCOUNT_PAGE_URL;
    });
  })();

  // Dashboard tab switching
  const dashTabs = document.querySelectorAll(".dash-content-tab");
  const adminListEl = document.getElementById("admin-list");
  const ordersSection = ordersWrap;
  const usersSection = usersWrap;
  
  if (dashTabs.length && adminListEl && ordersSection && usersSection) {
    // Hide orders/users by default, show products
    ordersSection.style.display = "none";
    usersSection.style.display = "none";
    
    dashTabs.forEach(function(tab) {
      tab.addEventListener("click", function() {
        dashTabs.forEach(function(t) { t.classList.remove("active"); });
        tab.classList.add("active");
        
        var section = tab.dataset.section;
        if (section === "products") {
          adminListEl.style.display = "grid";
          ordersSection.style.display = "none";
          usersSection.style.display = "none";
        } else if (section === "orders") {
          adminListEl.style.display = "none";
          ordersSection.style.display = "block";
          usersSection.style.display = "none";
        } else if (section === "users") {
          adminListEl.style.display = "none";
          ordersSection.style.display = "none";
          usersSection.style.display = "block";
          loadAdminUsers();
        } else {
          adminListEl.style.display = "none";
          ordersSection.style.display = "none";
          usersSection.style.display = "none";
        }
      });
    });
  }

  // Dashboard logout button
  var logoutBtnAdm = document.getElementById("adm-logout");
  if (logoutBtnAdm) {
    logoutBtnAdm.addEventListener("click", function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LOGIN_INTENT_KEY);
      window.location.href = "Admin.html";
    });
  }
})();

(function () {
  const accountPage = document.getElementById("account-page");
  if (!accountPage) return;

  const RESIDENT_TOKEN_KEY = "benzy_auth_token";
  const ADMIN_TOKEN_KEY = "benzy_admin_auth_token";
  const LOGIN_INTENT_KEY = "benzy_login_intent";
  const storedApiBase = readBenzyStoredApiBase();
  const API_BASE = storedApiBase && storedApiBase !== window.location.origin
    ? storedApiBase
    : "https://benzy-luxury-website.onrender.com";
  const ACCOUNT_PAGE_URL = "Account.html";
  const LOGIN_PAGE_URL = "Profile.html";
  const RESIDENT_HOME_URL = "Profile.html";
  const ADMIN_PAGE_URL = "AdminDashboard.html";
  const LEGACY_ADMIN_EMAILS = ["admin@benzyluxury.com"];

  function getResidentToken() {
    return localStorage.getItem(RESIDENT_TOKEN_KEY) || "";
  }

  function getAdminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  }

  function getTokenForIntent(intent = getIntent()) {
    return intent === "host" ? getAdminToken() : getResidentToken();
  }

  function setToken(token, intent = getIntent()) {
    const storageKey = intent === "host" ? ADMIN_TOKEN_KEY : RESIDENT_TOKEN_KEY;
    localStorage.setItem(storageKey, token || "");
  }

  function clearToken(intent = getIntent()) {
    const isHostIntent = intent === "host";
    const storageKey = isHostIntent ? ADMIN_TOKEN_KEY : RESIDENT_TOKEN_KEY;
    localStorage.removeItem(storageKey);
    if (isHostIntent) return;
    if (window.BenzyCartBridge && typeof window.BenzyCartBridge.handleLogout === "function") {
      window.BenzyCartBridge.handleLogout();
    } else {
      window.dispatchEvent(new CustomEvent("benzy:auth-logout"));
    }
  }

  function isHostUser(user) {
    const role = String(user?.role || "").trim().toLowerCase();
    if (role === "host") return true;
    const normalized = String(user?.email || "").trim().toLowerCase();
    return LEGACY_ADMIN_EMAILS.includes(normalized);
  }

  function setIntent(intent) {
    localStorage.setItem(LOGIN_INTENT_KEY, intent);
  }

  function getIntent() {
    const value = localStorage.getItem(LOGIN_INTENT_KEY) || "resident";
    return value === "host" ? "host" : "resident";
  }

  function clearIntent() {
    localStorage.removeItem(LOGIN_INTENT_KEY);
  }

  async function api(path, options, useAuth, authToken) {
    const headers = {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    };
    const token = String(authToken || "").trim() || (useAuth ? getTokenForIntent() : "");
    if (useAuth && token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${path}`, {
      method: options?.method || "GET",
      headers,
      body: options?.body || undefined
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.error || "Request failed.");
    }
    return data;
  }

  function handleAccountSelectorPage() {
    const hostTab = document.getElementById("tab-host");
    const residentTab = document.getElementById("tab-resident");
    if (!hostTab && !residentTab) return;

    if (residentTab) {
      residentTab.addEventListener("click", function () {
        setIntent("resident");
      });
    }

    if (hostTab) {
      hostTab.addEventListener("click", function () {
        setIntent("host");
      });
    }
  }

  function handleLoginPage() {
    const loginForm = document.getElementById("login-form");
    if (!loginForm) return;

    const msgEl = document.getElementById("account-msg");
    const titleEl = document.querySelector(".account-signin-title");
    const copyEl = document.querySelector(".account-signin-copy");
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const togglePasswordBtn = document.getElementById("toggle-login-password");
    const submitBtn = loginForm.querySelector("button[type='submit']");

    function showMessage(text, isError) {
      if (!msgEl) return;
      msgEl.textContent = text || "";
      msgEl.style.color = isError ? "#b01818" : "#1f6d34";
    }

    if (togglePasswordBtn instanceof HTMLButtonElement && passwordInput instanceof HTMLInputElement) {
      togglePasswordBtn.textContent = "Show";
      togglePasswordBtn.addEventListener("click", function () {
        const isHidden = passwordInput.type === "password";
        passwordInput.type = isHidden ? "text" : "password";
        togglePasswordBtn.textContent = isHidden ? "Hide" : "Show";
        togglePasswordBtn.setAttribute("aria-pressed", isHidden ? "true" : "false");
      });
    }

    const intent = getIntent();
    if (titleEl) titleEl.textContent = intent === "host" ? "Host Login" : "Resident Login";
    if (copyEl) {
      copyEl.textContent =
        intent === "host"
          ? "Admin access only. Enter host credentials."
          : "Sign in or create an account";
    }

    async function redirectIfAuthenticated() {
      const intent = getIntent();
      const token = getTokenForIntent(intent);
      if (!token) return;

      try {
        const data = await api("/api/auth/me", { method: "GET" }, true, token);
        const user = data?.user || {};

        if (isHostUser(user)) {
          clearIntent();
          window.location.href = ADMIN_PAGE_URL;
          return;
        }

        if (intent === "host") {
          clearToken("host");
          return;
        }

        clearIntent();
        window.location.href = RESIDENT_HOME_URL;
      } catch {
        clearToken(intent);
      }
    }

    redirectIfAuthenticated();

    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!(emailInput instanceof HTMLInputElement)) return;
      if (!(passwordInput instanceof HTMLInputElement)) return;

      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;
      const intent = getIntent();
      if (!email || password.length < 6) {
        showMessage("Enter a valid email and password (6+ chars).", true);
        return;
      }

      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Please wait...";
      }
      showMessage("", false);

      try {
        let authData;
        try {
          authData = await api("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
          }, false);
        } catch {
          if (intent === "host") {
            throw new Error("Host account not found or password is incorrect.");
          }
          const fallbackName = email.split("@")[0] || "User";
          authData = await api("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify({ name: fallbackName, email, password })
          }, false);
        }

        const token = authData?.token || "";
        const user = authData?.user || {};
        if (!token) throw new Error("Authentication failed.");

        if (isHostUser(user)) {
          setToken(token, "host");
          clearIntent();
          window.location.href = ADMIN_PAGE_URL;
          return;
        }

        if (intent === "host") {
          clearToken("host");
          showMessage("Host access is only for admin.", true);
          return;
        }

        setToken(token, "resident");
        if (window.BenzyCartBridge && typeof window.BenzyCartBridge.handleLoginSuccess === "function") {
          await window.BenzyCartBridge.handleLoginSuccess({ token, user });
        } else {
          window.dispatchEvent(new CustomEvent("benzy:auth-login", { detail: { token, user } }));
        }

        clearIntent();
        window.location.href = RESIDENT_HOME_URL;
      } catch (error) {
        showMessage(error.message || "Unable to continue.", true);
      } finally {
        if (submitBtn instanceof HTMLButtonElement) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Continue";
        }
      }
    });
  }

  handleAccountSelectorPage();
  if (!window.__BENZY_SKIP_LOGIN_BOOT) {
    handleLoginPage();
  }
})();

(function () {
  const profilePage = document.getElementById("profile-page");
  if (!profilePage) return;

  const TOKEN_KEY = "benzy_auth_token";
  const LOGIN_INTENT_KEY = "benzy_login_intent";
  const storedApiBase = readBenzyStoredApiBase();
  const API_BASE = storedApiBase && storedApiBase !== window.location.origin
    ? storedApiBase
    : "https://benzy-luxury-website.onrender.com";

  const profileMenu = document.getElementById("profile-menu");
  const menuItems = profileMenu ? Array.from(profileMenu.querySelectorAll(".profile-menu-item")) : [];
  const profilePanels = Array.from(document.querySelectorAll(".profile-panel"));
  const nameEl = document.getElementById("profile-name");
  const emailEl = document.getElementById("profile-email");
  const emailReadonlyEl = document.getElementById("profile-email-readonly");
  const msgEl = document.getElementById("profile-msg");
  const ordersCountEl = document.getElementById("profile-orders-count");
  const paymentsCountEl = document.getElementById("profile-payments-count");
  const walletBalanceEl = document.getElementById("profile-wallet-balance");
  const walletPanelBalanceEl = document.getElementById("profile-wallet-panel-balance");
  const ordersListEl = document.getElementById("profile-orders-list");
  const addressesListEl = document.getElementById("profile-addresses-list");
  const paymentsListEl = document.getElementById("profile-payments-list");
  const walletTxEl = document.getElementById("profile-wallet-tx");
  const logoutBtn = document.getElementById("profile-logout");
  const profileForm = document.getElementById("profile-form");
  const addressForm = document.getElementById("profile-address-form");
  const paymentForm = document.getElementById("profile-payment-form");
  const walletForm = document.getElementById("profile-wallet-form");
  const fullNameInput = document.getElementById("profile-fullname");
  const phoneInput = document.getElementById("profile-phone");
  const addressInput = document.getElementById("profile-address");
  const cityInput = document.getElementById("profile-city");
  const countryInput = document.getElementById("profile-country");
  const addressLineInput = document.getElementById("profile-address-line");
  const addressCityInput = document.getElementById("profile-address-city");
  const addressCountryInput = document.getElementById("profile-address-country");
  const paymentTypeInput = document.getElementById("profile-payment-type");
  const paymentHolderInput = document.getElementById("profile-payment-holder");
  const paymentLast4Input = document.getElementById("profile-payment-last4");
  const paymentDefaultInput = document.getElementById("profile-payment-default");
  const walletAmountInput = document.getElementById("profile-wallet-amount");
  const saveBtn = document.getElementById("profile-save");
  const addressAddBtn = document.getElementById("profile-address-add");
  const paymentAddBtn = document.getElementById("profile-payment-add");
  const walletTopupBtn = document.getElementById("profile-wallet-topup");
  let currentProfileEmail = "";
  let currentProfileData = {};

  function showMessage(text, isError) {
    if (!(msgEl instanceof HTMLElement)) return;
    msgEl.textContent = text || "";
    msgEl.style.color = isError ? "#b01818" : "#1f6d34";
  }

  function formatMoney(amount, currencyCode) {
    const safeAmount = Number(amount || 0);
    const code = String(currencyCode || "USD").toUpperCase();
    const localeMap = {
      USD: "en-US",
      NGN: "en-NG"
    };
    const locale = localeMap[code] || "en-US";
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        maximumFractionDigits: 2
      }).format(safeAmount);
    } catch {
      return safeAmount.toLocaleString();
    }
  }

  function normalizeUserEmail(email) {
    return String(email || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  }

  function decodeTokenEmail(token) {
    if (!token) return "";
    try {
      const payloadPart = token.split(".")[1] || "";
      if (!payloadPart) return "";
      const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const payload = JSON.parse(atob(padded));
      return String(payload?.email || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }

  function userOrdersKey(email) {
    return `benzy_account_${normalizeUserEmail(email)}_orders`;
  }

  function userPaymentsKey(email) {
    return `benzy_account_${normalizeUserEmail(email)}_payments`;
  }

  function userWalletKey(email) {
    return `benzy_account_${normalizeUserEmail(email)}_wallet`;
  }

  function userProfileKey(email) {
    return `benzy_account_${normalizeUserEmail(email)}_profile`;
  }

  function openPanel(key) {
    profilePanels.forEach((panel) => {
      const panelKey = panel.getAttribute("data-panel") || "";
      panel.classList.toggle("is-active", panelKey === key);
    });
    menuItems.forEach((item) => {
      const itemKey = item.getAttribute("data-target") || "";
      item.classList.toggle("active", itemKey === key);
    });
  }

  function loadJsonArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function loadWalletData(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{"balance":0,"tx":[]}');
      const balance = Number(parsed?.balance || 0);
      const tx = Array.isArray(parsed?.tx) ? parsed.tx : [];
      return { balance, tx };
    } catch {
      return { balance: 0, tx: [] };
    }
  }

  function saveWalletData(key, wallet) {
    localStorage.setItem(key, JSON.stringify(wallet || { balance: 0, tx: [] }));
  }

  function saveProfileDataByEmail(email, nextData) {
    localStorage.setItem(userProfileKey(email), JSON.stringify(nextData || {}));
    currentProfileData = nextData && typeof nextData === "object" ? nextData : {};
  }

  function buildPaymentLabel(item) {
    const type = String(item?.type || "Method");
    const holder = String(item?.holder || "Holder");
    const last4 = String(item?.last4 || "").padStart(4, "*").slice(-4);
    const isDefault = Boolean(item?.isDefault);
    return `${type} | ${holder} | **** ${last4}${isDefault ? " (Default)" : ""}`;
  }

  function renderAddresses(addresses) {
    if (!(addressesListEl instanceof HTMLElement)) return;
    const safeAddresses = Array.isArray(addresses) ? addresses : [];
    if (!safeAddresses.length) {
      addressesListEl.innerHTML = '<p class="profile-empty">No saved addresses.</p>';
      return;
    }

    addressesListEl.innerHTML = safeAddresses
      .map((item) => {
        const line = String(item?.line || "").trim();
        const city = String(item?.city || "").trim();
        const country = String(item?.country || "").trim();
        return `
          <article class="profile-address-item">
            <p>${line || "-"}</p>
            <p>${city || "-"}, ${country || "-"}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderPayments(payments) {
    if (!(paymentsListEl instanceof HTMLElement)) return;
    const safePayments = Array.isArray(payments) ? payments : [];
    if (!safePayments.length) {
      paymentsListEl.innerHTML = '<p class="profile-empty">No payment method saved.</p>';
      return;
    }

    paymentsListEl.innerHTML = safePayments
      .map((item) => {
        return `
          <article class="profile-payment-item">
            <p>${buildPaymentLabel(item)}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderWallet(wallet) {
    const safeWallet = wallet && typeof wallet === "object" ? wallet : { balance: 0, tx: [] };
    const balance = Number(safeWallet.balance || 0);
    const tx = Array.isArray(safeWallet.tx) ? safeWallet.tx : [];

    if (walletBalanceEl) walletBalanceEl.textContent = formatMoney(balance);
    if (walletPanelBalanceEl) walletPanelBalanceEl.textContent = formatMoney(balance);

    if (!(walletTxEl instanceof HTMLElement)) return;
    if (!tx.length) {
      walletTxEl.innerHTML = '<p class="profile-empty">No wallet activity yet.</p>';
      return;
    }

    walletTxEl.innerHTML = tx
      .slice()
      .reverse()
      .slice(0, 6)
      .map((item) => {
        const note = String(item?.note || "Wallet update");
        const amount = Number(item?.amount || 0);
        const date = String(item?.date || "").slice(0, 10) || "-";
        return `
          <article class="profile-wallet-item">
            <p>${note}</p>
            <p>${date} | ${formatMoney(amount)}</p>
          </article>
        `;
      })
      .join("");
  }

  function normalizeAddresses(profileData) {
    const list = Array.isArray(profileData?.addresses) ? profileData.addresses : [];
    const normalized = list
      .map((item) => ({
        line: String(item?.line || "").trim(),
        city: String(item?.city || "").trim(),
        country: String(item?.country || "").trim()
      }))
      .filter((item) => item.line || item.city || item.country);

    const fallbackLine = String(profileData?.address || "").trim();
    if (fallbackLine && !normalized.length) {
      normalized.push({
        line: fallbackLine,
        city: String(profileData?.city || "").trim(),
        country: String(profileData?.country || "").trim()
      });
    }

    return normalized;
  }

  function loadProfileData(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function hydrateProfileForm(data, fallbackName) {
    const safeData = data && typeof data === "object" ? data : {};
    if (fullNameInput instanceof HTMLInputElement) {
      fullNameInput.value = String(safeData.fullName || fallbackName || "").trim();
    }
    if (phoneInput instanceof HTMLInputElement) {
      phoneInput.value = String(safeData.phone || "").trim();
    }
    if (addressInput instanceof HTMLInputElement) {
      addressInput.value = String(safeData.address || "").trim();
    }
    if (cityInput instanceof HTMLInputElement) {
      cityInput.value = String(safeData.city || "").trim();
    }
    if (countryInput instanceof HTMLInputElement) {
      countryInput.value = String(safeData.country || "").trim();
    }
  }

  function renderOrders(orders) {
    if (!(ordersListEl instanceof HTMLElement)) return;
    const safeOrders = Array.isArray(orders) ? orders : [];
    if (!safeOrders.length) {
      ordersListEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <p>No orders found</p>
          <a href="Shop.html?cat=all" class="btn-secondary">Start Shopping</a>
        </div>
      `;
      return;
    }

    ordersListEl.innerHTML = safeOrders
      .slice()
      .sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")))
      .map((order) => {
        const id = String(order?.id || "Order");
        const title = String(order?.title || "Order");
        const image = String(order?.image || "");
        const qty = Math.max(1, parseInt(String(order?.qty || 1), 10));
        const status = String(order?.status || "Processing");
        const paymentStatus = String(order?.paymentStatus || "Pending");
        const date = String(order?.date || "-");
        const currency = String(order?.currency || "USD").toUpperCase();
        const total = formatMoney(Number(order?.total || 0), currency);
        
        // Determine status class
        const statusClass = status.toLowerCase();
        // Determine payment status class
        const paymentClass = paymentStatus.toLowerCase();
        
        return `
          <article class="order-card" data-order-id="${id}">
            <div class="order-card-top">
              <div class="order-info">
                <span class="order-label">Order ID</span>
                <h3 class="order-id">${id}</h3>
                <p class="order-date">${date}</p>
              </div>
              <div class="order-status-badge status-${statusClass}">
                <span class="status-dot"></span>
                ${status}
              </div>
            </div>
            
            <div class="order-items-preview">
              ${image ? `<img src="${image}" alt="${title}" class="order-item-image" />` : ''}
              <div class="order-item-details">
                <p class="order-item-name">${title}</p>
                <p class="order-item-qty">Quantity: ${qty}</p>
              </div>
            </div>
            
            <div class="order-card-footer">
              <div class="order-total">
                <span class="order-label">Total</span>
                <strong>${total}</strong>
              </div>
              <div class="order-payment-status payment-${paymentClass}">
                ${paymentStatus === 'Paid' ? '✓ ' : paymentStatus === 'Pending' ? '⏳ ' : '✕ '}${paymentStatus}
              </div>
              <div class="order-actions">
                <button class="order-action-btn btn-view" onclick="viewOrderDetails('${id}')">View Details</button>
                <button class="order-action-btn btn-track" onclick="trackOrderFromProfile('${id}')">Track Order</button>
                <button class="order-action-btn btn-reorder" onclick="reorderItems('${id}')">Reorder</button>
                <button class="order-action-btn btn-download" onclick="downloadReceipt('${id}')">Download Receipt</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  // Order action functions
  window.viewOrderDetails = function(orderId) {
    const orders = loadJsonArray(userOrdersKey(currentProfileEmail));
    const order = orders.find(o => o.id === orderId);
    if (order) {
      // Show order details modal or navigate to details page
      alert(`Order Details for ${orderId}\n\nProduct: ${order.title}\nQuantity: ${order.qty}\nTotal: ${formatMoney(order.total, order?.currency)}\nStatus: ${order.status}\nPayment: ${order.paymentStatus || 'Pending'}`);
    }
  };

  window.trackOrderFromProfile = function(orderId) {
    // Navigate to tracking section or trigger tracking
    const trackingSection = document.getElementById('section-order-tracking');
    if (trackingSection) {
      trackingSection.scrollIntoView({ behavior: 'smooth' });
      // Pre-fill tracking input
      const trackInput = document.getElementById('track-order-input');
      if (trackInput) trackInput.value = orderId;
    }
  };

  window.reorderItems = function(orderId) {
    const orders = loadJsonArray(userOrdersKey(currentProfileEmail));
    const order = orders.find(o => o.id === orderId);
    if (order && order.productId) {
      // Navigate to product page for reorder
      window.location.href = `Product.html?id=${order.productId}`;
    } else {
      // Navigate to shop if no product ID
      window.location.href = 'Shop.html?cat=all';
    }
  };

  window.downloadReceipt = function(orderId) {
    const orders = loadJsonArray(userOrdersKey(currentProfileEmail));
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Create receipt content
    const receiptContent = `
BENZY LUXURY - ORDER RECEIPT
=====================================

Order ID: ${order.id}
Date: ${order.date}

-----------------------------------
ITEM
-----------------------------------
${order.title}
Quantity: ${order.qty}
Price: ${formatMoney(order.total, order?.currency)}

-----------------------------------
SUMMARY
-----------------------------------
Subtotal: ${formatMoney(order.total, order?.currency)}
Shipping: ${formatMoney(order.shipping || 0, order?.currency)}
Total: ${formatMoney((order.total || 0) + (order.shipping || 0), order?.currency)}

-----------------------------------
Payment Status: ${order.paymentStatus || 'Pending'}
Order Status: ${order.status}

Thank you for shopping with Benzy Luxury!
    `;

    // Create and download text file
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt-${orderId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  async function initProfile() {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) {
      localStorage.setItem(LOGIN_INTENT_KEY, "resident");
      window.location.href = "Account.html";
      return;
    }

    const tokenEmail = decodeTokenEmail(token);
    if (!tokenEmail) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.setItem(LOGIN_INTENT_KEY, "resident");
      window.location.href = "Account.html";
      return;
    }

    showMessage("Loading profile...", false);

    let profileName = tokenEmail.split("@")[0] || "Resident";
    let profileEmail = tokenEmail;
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(function () {
        return null;
      });
      if (!response.ok) throw new Error(data?.error || "Session expired.");
      profileName = String(data?.user?.name || profileName);
      profileEmail = String(data?.user?.email || profileEmail).trim().toLowerCase();
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.setItem(LOGIN_INTENT_KEY, "resident");
      window.location.href = LOGIN_PAGE_URL;
      return;
    }

    if (nameEl) nameEl.textContent = profileName;
    if (emailEl) emailEl.textContent = profileEmail;
    if (emailReadonlyEl instanceof HTMLInputElement) emailReadonlyEl.value = profileEmail;

    const orders = loadJsonArray(userOrdersKey(profileEmail));
    const payments = loadJsonArray(userPaymentsKey(profileEmail));
    const wallet = loadWalletData(userWalletKey(profileEmail));
    const profileData = loadProfileData(userProfileKey(profileEmail));
    currentProfileEmail = profileEmail;
    currentProfileData = profileData && typeof profileData === "object" ? profileData : {};
    const addresses = normalizeAddresses(currentProfileData);
    currentProfileData.addresses = addresses;

    const displayName = String(profileData?.fullName || profileName).trim();
    if (nameEl) nameEl.textContent = displayName || profileName;
    hydrateProfileForm(profileData, displayName || profileName);
    renderAddresses(addresses);
    renderPayments(payments);
    renderWallet(wallet);

    if (ordersCountEl) ordersCountEl.textContent = String(orders.length);
    if (paymentsCountEl) paymentsCountEl.textContent = String(payments.length);
    renderOrders(orders);
    showMessage("", false);
    openPanel("orders");
  }

  if (logoutBtn instanceof HTMLButtonElement) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem(TOKEN_KEY);
      if (window.BenzyCartBridge && typeof window.BenzyCartBridge.handleLogout === "function") {
        window.BenzyCartBridge.handleLogout();
      } else {
        window.dispatchEvent(new CustomEvent("benzy:auth-logout"));
      }
      localStorage.setItem(LOGIN_INTENT_KEY, "resident");
      window.location.href = "Account.html";
    });
  }

  if (profileForm instanceof HTMLFormElement) {
    profileForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!currentProfileEmail) return;

      const fullName = fullNameInput instanceof HTMLInputElement ? fullNameInput.value.trim() : "";
      const phone = phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : "";
      const address = addressInput instanceof HTMLInputElement ? addressInput.value.trim() : "";
      const city = cityInput instanceof HTMLInputElement ? cityInput.value.trim() : "";
      const country = countryInput instanceof HTMLInputElement ? countryInput.value.trim() : "";

      const nextAddresses = normalizeAddresses({ ...currentProfileData, address, city, country });
      const payload = {
        ...currentProfileData,
        fullName,
        phone,
        address,
        city,
        country,
        addresses: nextAddresses,
        updatedAt: new Date().toISOString()
      };
      saveProfileDataByEmail(currentProfileEmail, payload);

      if (nameEl && fullName) nameEl.textContent = fullName;
      renderAddresses(nextAddresses);

      if (saveBtn instanceof HTMLButtonElement) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saved";
        window.setTimeout(function () {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Details";
        }, 900);
      }
      showMessage("Profile details updated.", false);
    });
  }

  if (addressForm instanceof HTMLFormElement) {
    addressForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!currentProfileEmail) return;

      const line = addressLineInput instanceof HTMLInputElement ? addressLineInput.value.trim() : "";
      const city = addressCityInput instanceof HTMLInputElement ? addressCityInput.value.trim() : "";
      const country = addressCountryInput instanceof HTMLInputElement ? addressCountryInput.value.trim() : "";
      if (!line) {
        showMessage("Address line is required.", true);
        return;
      }

      const existing = normalizeAddresses(currentProfileData);
      const next = [...existing, { line, city, country }];
      const payload = { ...currentProfileData, addresses: next, updatedAt: new Date().toISOString() };
      saveProfileDataByEmail(currentProfileEmail, payload);
      renderAddresses(next);

      if (addressLineInput instanceof HTMLInputElement) addressLineInput.value = "";
      if (addressCityInput instanceof HTMLInputElement) addressCityInput.value = "";
      if (addressCountryInput instanceof HTMLInputElement) addressCountryInput.value = "";

      if (addressAddBtn instanceof HTMLButtonElement) {
        addressAddBtn.disabled = true;
        addressAddBtn.textContent = "Added";
        window.setTimeout(function () {
          addressAddBtn.disabled = false;
          addressAddBtn.textContent = "Add Address";
        }, 900);
      }
      showMessage("Address saved.", false);
    });
  }

  if (paymentForm instanceof HTMLFormElement) {
    paymentForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!currentProfileEmail) return;

      const type = paymentTypeInput instanceof HTMLInputElement ? paymentTypeInput.value.trim() : "";
      const holder = paymentHolderInput instanceof HTMLInputElement ? paymentHolderInput.value.trim() : "";
      const last4Raw = paymentLast4Input instanceof HTMLInputElement ? paymentLast4Input.value.trim() : "";
      const last4 = last4Raw.replace(/\D/g, "").slice(-4);
      const isDefault = paymentDefaultInput instanceof HTMLInputElement ? paymentDefaultInput.checked : false;

      if (!type || !holder || last4.length !== 4) {
        showMessage("Enter payment type, holder name, and 4-digit last numbers.", true);
        return;
      }

      const key = userPaymentsKey(currentProfileEmail);
      const existing = loadJsonArray(key);
      const next = Array.isArray(existing) ? existing : [];
      if (isDefault) {
        next.forEach((item) => {
          if (item && typeof item === "object") item.isDefault = false;
        });
      }
      next.push({ type, holder, last4, isDefault });
      localStorage.setItem(key, JSON.stringify(next));
      renderPayments(next);
      if (paymentsCountEl) paymentsCountEl.textContent = String(next.length);

      if (paymentTypeInput instanceof HTMLInputElement) paymentTypeInput.value = "";
      if (paymentHolderInput instanceof HTMLInputElement) paymentHolderInput.value = "";
      if (paymentLast4Input instanceof HTMLInputElement) paymentLast4Input.value = "";
      if (paymentDefaultInput instanceof HTMLInputElement) paymentDefaultInput.checked = false;

      if (paymentAddBtn instanceof HTMLButtonElement) {
        paymentAddBtn.disabled = true;
        paymentAddBtn.textContent = "Added";
        window.setTimeout(function () {
          paymentAddBtn.disabled = false;
          paymentAddBtn.textContent = "Add Payment";
        }, 900);
      }
      showMessage("Payment method saved.", false);
    });
  }

  if (walletForm instanceof HTMLFormElement) {
    walletForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!currentProfileEmail) return;

      const amount = walletAmountInput instanceof HTMLInputElement ? Number(walletAmountInput.value || 0) : 0;
      if (!Number.isFinite(amount) || amount <= 0) {
        showMessage("Enter a valid top-up amount.", true);
        return;
      }

      const key = userWalletKey(currentProfileEmail);
      const wallet = loadWalletData(key);
      wallet.balance = Number((Number(wallet.balance || 0) + amount).toFixed(2));
      wallet.tx = Array.isArray(wallet.tx) ? wallet.tx : [];
      wallet.tx.push({ amount, date: new Date().toISOString(), note: "Wallet top-up" });
      saveWalletData(key, wallet);
      renderWallet(wallet);

      if (walletAmountInput instanceof HTMLInputElement) walletAmountInput.value = "";
      if (walletTopupBtn instanceof HTMLButtonElement) {
        walletTopupBtn.disabled = true;
        walletTopupBtn.textContent = "Added";
        window.setTimeout(function () {
          walletTopupBtn.disabled = false;
          walletTopupBtn.textContent = "Top Up";
        }, 900);
      }
      showMessage("Wallet funded successfully.", false);
    });
  }

  if (profileMenu instanceof HTMLElement) {
    profileMenu.addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const item = target.closest(".profile-menu-item");
      if (!(item instanceof HTMLButtonElement)) return;
      const key = item.getAttribute("data-target") || "";
      if (!key) return;
      openPanel(key);
    });
  }

  if (!window.__BENZY_SKIP_PROFILE_BOOT) {
    initProfile();
  }
})();
const MANUAL_USD_TO_NGN = 1376.86;
const CURRENCY_KEY = "benzy_currency";
const PRODUCT_OVERRIDES_KEY = "benzy_product_overrides";
const PRODUCT_CURRENCY_CONFIG = {
  USD: { locale: "en-US", currency: "USD", rateFromNgn: 1 / MANUAL_USD_TO_NGN },
  NGN: { locale: "en-NG", currency: "NGN", rateFromNgn: 1 }
};
const CURRENCY_SYMBOLS = {
  USD: "$",   // US Dollar
  NGN: "â‚¦",   // Nigerian Naira
};

CURRENCY_SYMBOLS.NGN = "\u20A6";

function getCurrencyService() {
  return window.BenzyCurrency && typeof window.BenzyCurrency === "object"
    ? window.BenzyCurrency
    : null;
}

function getCurrencyConfigByCode(code) {
  const normalizedCode = String(code || "NGN").trim().toUpperCase();
  const service = getCurrencyService();
  if (service?.getCurrencyConfig) {
    return service.getCurrencyConfig(normalizedCode);
  }

  return PRODUCT_CURRENCY_CONFIG[normalizedCode] || PRODUCT_CURRENCY_CONFIG.NGN;
}

function convertPriceFromNgn(ngnAmount, targetCurrency) {
  const service = getCurrencyService();
  if (service?.convertPrice) {
    return Number(service.convertPrice(ngnAmount, targetCurrency));
  }

  const cfg = getCurrencyConfigByCode(targetCurrency);
  return Number(ngnAmount || 0) * Number(cfg.rateFromNgn || 1);
}

function convertAmountToNgn(amount, sourceCurrency) {
  const normalizedCode = String(sourceCurrency || "NGN").trim().toUpperCase();
  const service = getCurrencyService();
  if (service?.convertAmount) {
    return Number(service.convertAmount(amount, normalizedCode, "NGN"));
  }

  if (normalizedCode === "NGN") return Number(amount || 0);
  const cfg = PRODUCT_CURRENCY_CONFIG[normalizedCode] || PRODUCT_CURRENCY_CONFIG.USD;
  return Number(cfg.rateFromNgn || 0) > 0
    ? Number(amount || 0) / Number(cfg.rateFromNgn)
    : Number(amount || 0) * MANUAL_USD_TO_NGN;
}

function getCurrencySymbolForCode(code) {
  const normalizedCode = String(code || "NGN").trim().toUpperCase();
  const service = getCurrencyService();
  if (service?.getCurrencySymbol) {
    return service.getCurrencySymbol(normalizedCode);
  }

  return CURRENCY_SYMBOLS[normalizedCode] || "$";
}

let BENZY_PRODUCTS = [
  { id: 0, name: "BENZYLUX WHITE JERSEY", priceNgn: 35000, category: "men", inStock: true, images: ["OFF BACK/BENZYLUX_WHITE_JERSEY_FRONT.png", "OFF BACK/BENZYLUX_WHITE_JERSEY_BACK.png"] },
  { id: 1, name: "BENZYLUX BLACK JERSEY", priceNgn: 35000, category: "men", inStock: true, images: ["OFF BACK/BENZY LUXURY BLACK FRONT.png", "OFF BACK/BENZY LUXURY BLACK BACK.png"] },
  { id: 2, name: "BENZYLUX RED JERSEY", priceNgn: 25000, category: "men", inStock: true, images: ["OFF BACK/Benzy_Luxury_Jersey_Red_FRONT_with_bgc.png", "OFF BACK/Benzy_Luxury_Jersey_Red_BACK_with_bgc.png"] },
  { id: 3, name: "BENZYLUX IN-RED JERSEY", priceNgn: 25000, category: "men", inStock: true, images: ["OFF BACK/Benzy_Luxury_Jersey_Red_Inverted_BACK_with_bgc.png", "OFF BACK/Benzy_Luxury_Jersey_Red_Inverted_FRONT_with_bgc.png"] },
  { id: 4, name: "BENZYLUX BLUE JERSEY", priceNgn: 25000, category: "men", inStock: true, images: ["OFF BACK/Benzy_Luxury_Jersey_Blue_FRONT_with_bgc.png", "OFF BACK/Benzy_Luxury_Jersey_Blue_BACK_with_bgc.png"] },
  { id: 5, name: "BENZYLUX BROWN JERSEY", priceNgn: 25000, category: "men", inStock: true, images: ["OFF BACK/Benzy_Luxury_Jersey_Brown_Front_with_bgc (2).png", "OFF BACK/Benzy_Luxury_Jersey_Brown_BACK_with_bgc.png"] },
  { id: 6, name: "BENZYLUX LILAC JERSEY", priceNgn: 25000, category: "women", inStock: true, images: ["OFF BACK/Benzy_Luxury_Jersey_Lilac_FRONT_with_bgc.png", "OFF BACK/Benzy_Luxury_Jersey_Lilac_BACK_with_bgc (2).png"] },
  { id: 7, name: "BENZYLUX PINK JERSEY", priceNgn: 25000, category: "women", inStock: true, images: ["OFF BACK/Benzy_Luxury_Jersey_Pink_BACK_with_bgc.png", "OFF BACK/Benzy_Luxury_Jersey_Pink_FRONT_with_bgc.png"] },
  { id: 8, name: "BENZYLUX IN-PINK JERSEY", priceNgn: 25000, category: "women", inStock: true, images: ["OFF BACK/Benzy_Luxury_Jersey_Pink_Inverted_FRONT_with_bgc.png", "OFF BACK/Benzy_Luxury_Jersey_Pink_Inverted_BACK_with_bgc.png"] },
  { id: 9, name: "BENZYLUX GREEN JERSEY", priceNgn: 25000, category: "men", inStock: true, images: ["OFF BACK/Benzy Luxury Jersey Green front.png", "OFF BACK/Benzy Luxury Jersey Green Back.png"] },
  { id: 10, name: "BENZYLUX IN-GREEN JERSEY", priceNgn: 25000, category: "men", inStock: true, images: ["OFF BACK/Benzy Luxury Jersey Inv Green front.png", "OFF BACK/Benzy Luxury Jersey Inv Green Back.png"] },
  { id: 11, name: "BENZYLUX(BLX) WHITE BASIC TOP", priceNgn: 10000, category: "women", inStock: true, images: ["OFF BACK/Benzy Luxury Basic Top main.png"] },
  { id: 12, name: "BENZYLUX(BLX) BLACK BASIC TOP", priceNgn: 10000, category: "women", inStock: true, images: ["OFF BACK/Benzy Luxury Basic Top Black.png"] },
  { id: 13, name: "BENZYLUX(BLX) BASIC TOPS", priceNgn: 10000, category: "women", inStock: true, images: ["OFF BACK/Benzy Luxury Basic Tops.png"] },
  { id: 14, name: "BENZYLUX METROPOLITAN SOCKS", priceNgn: 4000, category: "accessories", inStock: true, images: ["OFF BACK/WhatsApp Image 2025-11-11 at 08.50.33_976d3882.png"] },
  { id: 15, name: "BENZYLUX(BLX) TRACK", priceNgn: 60000, category: "men", inStock: true, images: ["OFF BACK/WhatsApp Image 2025-11-11 at 08.42.31_83a04cd4.png", "OFF BACK/WhatsApp Image 2025-11-11 at 08.42.28_f079be7b.png"] },
  { id: 16, name: "BENZYLUX CAMO TRUNKERS", priceNgn: 10000, category: "accessories", inStock: true, images: ["OFF BACK/WhatsApp Image 2025-11-11 at 08.53.09_a611d1ed.png"] },
  { id: 17, name: "BENZYLUX BEANIE", priceNgn: 15000, category: "accessories", inStock: true, images: ["OFF BACK/WhatsApp Image 2025-11-11 at 08.53.08_11fe630f.png", "OFF BACK/WhatsApp Image 2025-11-11 at 08.53.08_4333b0d7.png"] },
  { id: 18, name: "BENZYLUX JACKET", priceNgn: 20000, category: "men", inStock: true, images: ["OFF BACK/WhatsApp Image 2025-11-11 at 08.53.09_1aedccce.png"] }
];

const BENZY_PRODUCTS_READY = loadLiveProductCatalog();
const CART_STORAGE_KEY = "benzy_cart_items";

function getProductApiBases() {
  const bases = [];
  const origin = window.location.origin;
  const stored = readBenzyStoredApiBase();
  bases.push("https://benzy-luxury-website.onrender.com");
  if (stored && stored !== origin) bases.push(stored);
  return Array.from(new Set(bases));
}

function getProductCategoryTokens(product) {
  const rawValues = [
    ...(Array.isArray(product?.categoryIds) ? product.categoryIds : []),
    ...(Array.isArray(product?.categories) ? product.categories : []),
    product?.category,
    product?.categoryId,
    product?.categoryName
  ];
  const knownCategories = ["men", "women", "accessories"];
  const tokens = [];

  rawValues.forEach((entry) => {
    const raw = String(entry || "").trim();
    if (!raw) return;
    const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    knownCategories.forEach((category) => {
      const matcher = new RegExp(`(^|-)${category}(-|$)`, "i");
      if (matcher.test(normalized) && !tokens.includes(category)) tokens.push(category);
    });
    raw
      .split(/[,/&|]+|\band\b|\s+/i)
      .map((value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
      .filter(Boolean)
      .forEach((value) => {
        if (!tokens.includes(value)) tokens.push(value);
      });
  });

  return tokens;
}

function normalizeLiveProduct(raw, index) {
  const productId = String(raw?.productId || raw?.id || "").trim();
  const metadata = raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  const variants = Array.isArray(raw?.variants) ? raw.variants.filter(Boolean) : [];
  const images = [
    ...(Array.isArray(raw?.images) ? raw.images : []),
    raw?.image,
    raw?.image1,
    raw?.image2,
    ...variants.map((variant) => variant?.image)
  ]
    .map((src) => String(src || "").trim())
    .filter(Boolean)
    .filter((src, imageIndex, list) => list.indexOf(src) === imageIndex);
  const colors = [
    ...(Array.isArray(raw?.colors) ? raw.colors : []),
    ...(Array.isArray(metadata?.availableColors) ? metadata.availableColors : []),
    ...(Array.isArray(metadata?.colors) ? metadata.colors : []),
    ...variants.map((variant) => variant?.color)
  ]
    .map((color) => String(color || "").trim())
    .filter(Boolean)
    .filter((color, colorIndex, list) => list.findIndex((entry) => entry.toLowerCase() === color.toLowerCase()) === colorIndex);
  const variantSku = variants.find((variant) => String(variant?.sku || "").trim())?.sku || "";
  const priceNgn = Number(raw?.priceNgn ?? raw?.price ?? 0);
  const discountPriceNgn = Number(
    raw?.discountPrice
    ?? raw?.salePrice
    ?? raw?.discountedPrice
    ?? metadata?.discountPrice
    ?? metadata?.salePrice
    ?? 0
  );
  const stockQuantity = Number.parseInt(String(raw?.stockQuantity ?? 0), 10);

  const categoryTokens = getProductCategoryTokens(raw);

  return {
    id: productId || `live-${index}`,
    productId: productId || `live-${index}`,
    name: String(raw?.name || "Product").trim(),
    priceNgn: Number.isFinite(priceNgn) ? priceNgn : 0,
    discountPriceNgn: Number.isFinite(discountPriceNgn) ? discountPriceNgn : 0,
    category: categoryTokens[0] || "all",
    categoryIds: categoryTokens,
    categoryName: String(raw?.categoryName || "").trim(),
    inStock: raw?.inStock !== false && (!Number.isFinite(stockQuantity) || stockQuantity > 0),
    stockQuantity: Number.isFinite(stockQuantity) ? Math.max(0, stockQuantity) : 0,
    images,
    description: String(raw?.description || "").trim(),
    sizes: Array.isArray(raw?.sizes) ? raw.sizes.filter(Boolean) : [],
    colors,
    colorLabel: String(raw?.colorLabel || colors[0] || "").trim(),
    sku: String(raw?.sku || metadata?.sku || variantSku || "").trim(),
    variants,
    metadata,
    updatedAt: raw?.updatedAt || null,
    createdAt: raw?.createdAt || null
  };
}

async function loadLiveProductCatalog() {
  for (const base of getProductApiBases()) {
    try {
      const response = await fetch(`${base}/api/products`, { headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      const products = Array.isArray(data?.products) ? data.products : [];
      if (!response.ok || !products.length) continue;
      BENZY_PRODUCTS = products.map(normalizeLiveProduct).filter((product) => product.name && product.images.length);
      if (BENZY_PRODUCTS.length) {
        localStorage.setItem("benzy_api_base", base);
        window.dispatchEvent(new CustomEvent("benzy:products-updated"));
        return BENZY_PRODUCTS;
      }
    } catch {
      // Keep the built-in catalog when the backend is unavailable.
    }
  }

  return BENZY_PRODUCTS;
}

function loadProductOverrides() {
  try {
    const parsed = JSON.parse(localStorage.getItem("benzy_product_overrides") || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveProductOverrides(overrides) {
  localStorage.setItem("benzy_product_overrides", JSON.stringify(overrides || {}));
  window.dispatchEvent(new CustomEvent("benzy:product-overrides-updated"));
}

function getProductOverride(productId) {
  const all = loadProductOverrides();
  return all[String(productId)] || null;
}

function getHydratedProduct(product) {
  if (!product) return null;
  const ov = getProductOverride(product.id) || getProductOverride(product.productId);
  const images = normalizeProductImages(product);
  if (!ov) return { ...product, images };

  return {
    ...product,
    images,
    inStock: typeof ov.inStock === "boolean" ? ov.inStock : product.inStock,
    colorLabel: typeof ov.colorLabel === "string" && ov.colorLabel.trim() ? ov.colorLabel.trim() : product.colorLabel,
    colorHex: typeof ov.colorHex === "string" && ov.colorHex.trim() ? ov.colorHex.trim() : product.colorHex,
    colorBorder: typeof ov.colorBorder === "string" && ov.colorBorder.trim() ? ov.colorBorder.trim() : product.colorBorder
  };
}

function getProductById(id) {
  const product = BENZY_PRODUCTS.find((item) => String(item.id) === String(id) || String(item.productId) === String(id));
  return getHydratedProduct(product);
}

function getActiveCurrencyCode() {
  const service = getCurrencyService();
  if (service?.getSelectedCurrency) {
    return service.getSelectedCurrency();
  }

  const saved = localStorage.getItem(CURRENCY_KEY) || "NGN";
  return PRODUCT_CURRENCY_CONFIG[saved] ? saved : "NGN";
}

function formatProductPrice(ngnAmount) {
  const code = getActiveCurrencyCode();
  const service = getCurrencyService();
  if (service?.formatPriceFromNgn) {
    return service.formatPriceFromNgn(ngnAmount, code);
  }

  const cfg = getCurrencyConfigByCode(code);
  const converted = convertPriceFromNgn(ngnAmount, code);
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    maximumFractionDigits: 2
  }).format(converted);
}

function getProductSalePriceNgn(product) {
  const regularPrice = Number(product?.priceNgn ?? product?.price ?? 0);
  const discountPrice = Number(
    product?.discountPriceNgn
    ?? product?.discountPrice
    ?? product?.salePrice
    ?? product?.discountedPrice
    ?? product?.metadata?.discountPrice
    ?? 0
  );

  return Number.isFinite(discountPrice) && discountPrice > 0 && discountPrice < regularPrice
    ? discountPrice
    : 0;
}

function getProductDisplayPriceNgn(product) {
  return getProductSalePriceNgn(product) || Number(product?.priceNgn ?? product?.price ?? 0);
}

function formatProductPriceHtml(product) {
  const salePrice = getProductSalePriceNgn(product);
  const regularPrice = Number(product?.priceNgn ?? product?.price ?? 0);
  if (!salePrice) return escapeProductHtml(formatProductPrice(regularPrice));

  return `
    <span class="product-price-sale">${escapeProductHtml(formatProductPrice(salePrice))}</span>
    <span class="product-price-compare">${escapeProductHtml(formatProductPrice(regularPrice))}</span>
  `;
}

function formatCurrencyByCode(amount, code) {
  const normalizedCode = String(code || "NGN").trim().toUpperCase();
  const service = getCurrencyService();
  if (service?.formatCurrency) {
    return service.formatCurrency(amount, normalizedCode);
  }

  const cfg = getCurrencyConfigByCode(normalizedCode);
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

function formatNgnPlain(ngnAmount) {
  return `${getCurrencySymbolForCode("NGN")}${Number(ngnAmount || 0).toLocaleString()}.00`;
}

function isJerseyProduct(product) {
  return String(product?.name || "").toUpperCase().includes("JERSEY");
}

function productCategoryTags(product) {
  if (isJerseyProduct(product)) return "men women";
  return getProductCategoryTokens(product).join(" ") || "all";
}

function productMatchesCategory(product, cat) {
  const normalizedCat = String(cat || "all").toLowerCase();
  if (normalizedCat === "all") return true;
  if ((normalizedCat === "men" || normalizedCat === "women") && isJerseyProduct(product)) return true;
  return getProductCategoryTokens(product).includes(normalizedCat);
}

function isProductInStock(product) {
  const ov = getProductOverride(product?.id) || getProductOverride(product?.productId);
  if (ov && typeof ov.inStock === "boolean") return ov.inStock;
  return product.inStock !== false;
}

function getProductStockQuantity(product) {
  const ov = getProductOverride(product?.id) || getProductOverride(product?.productId);
  const stock = Number.parseInt(String(ov?.stockQuantity ?? product?.stockQuantity ?? 0), 10);
  if (!Number.isFinite(stock) || stock < 0) return 0;
  return stock;
}

function getKnownProductColors() {
  return [
    { key: "WHITE", label: "White", hex: "#f5f5f5", border: "#b8b8b8" },
    { key: "BLACK", label: "Black", hex: "#111111", border: "#111111" },
    { key: "RED", label: "Red", hex: "#c8102e", border: "#9f0f25" },
    { key: "BLUE", label: "Blue", hex: "#1e4ed8", border: "#1b3fb0" },
    { key: "GREEN", label: "Green", hex: "#1f7a3a", border: "#17592b" },
    { key: "PINK", label: "Pink", hex: "#f06da6", border: "#cc4d84" },
    { key: "BROWN", label: "Brown", hex: "#7a4a23", border: "#5e381a" },
    { key: "LILAC", label: "Lilac", hex: "#b38fd8", border: "#9772c0" },
    { key: "PURPLE", label: "Purple", hex: "#7c3aed", border: "#5b21b6" },
    { key: "NAVY", label: "Navy", hex: "#172554", border: "#0f172a" },
    { key: "GREY", label: "Grey", hex: "#8a8f98", border: "#6b7280" },
    { key: "GRAY", label: "Grey", hex: "#8a8f98", border: "#6b7280" },
    { key: "ASH", label: "Ash", hex: "#9ca3af", border: "#6b7280" },
    { key: "CREAM", label: "Cream", hex: "#f2ead7", border: "#d8c9a8" },
    { key: "BEIGE", label: "Beige", hex: "#d6c3a3", border: "#b8a17b" },
    { key: "OLIVE", label: "Olive", hex: "#6b7b3f", border: "#4f5f2e" },
    { key: "GOLD", label: "Gold", hex: "#d4af37", border: "#a47f16" },
    { key: "SILVER", label: "Silver", hex: "#c0c4cc", border: "#8f96a3" },
    { key: "ORANGE", label: "Orange", hex: "#f97316", border: "#c2410c" },
    { key: "YELLOW", label: "Yellow", hex: "#e5c100", border: "#b79a00" },
    { key: "CAMO", label: "Camo", hex: "#566346", border: "#425036" }
  ];
}

function resolveProductColorInfo(value) {
  const raw = String(value || "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    return { label: raw, hex: raw, border: raw };
  }

  const normalized = raw.toUpperCase();
  const matched = getKnownProductColors().find((item) => normalized.includes(item.key));
  if (matched) return { ...matched, label: raw && raw !== matched.key ? raw : matched.label };
  if (raw) return { label: raw, hex: "#d0d0d0", border: "#9e9e9e" };

  return { label: "Default", hex: "#d0d0d0", border: "#9e9e9e" };
}

function getProductColorOptions(product) {
  const ov = getProductOverride(product?.id) || getProductOverride(product?.productId);
  const savedColorHex = ov?.colorHex || product?.colorHex;
  const savedColorLabel = ov?.colorLabel || product?.colorLabel;
  const savedColorBorder = ov?.colorBorder || product?.colorBorder;
  if (typeof savedColorHex === "string" && savedColorHex.trim()) {
    return [{
      label: savedColorLabel && String(savedColorLabel).trim() ? String(savedColorLabel).trim() : "Custom",
      hex: savedColorHex.trim(),
      border: savedColorBorder && String(savedColorBorder).trim() ? String(savedColorBorder).trim() : "#888888"
    }];
  }

  const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  const adminColors = [
    ...(Array.isArray(product?.colors) ? product.colors : []),
    ...(Array.isArray(metadata?.availableColors) ? metadata.availableColors : []),
    ...(Array.isArray(metadata?.colors) ? metadata.colors : []),
    ...(Array.isArray(product?.variants) ? product.variants.map((variant) => variant?.color) : []),
    product?.colorLabel
  ]
    .map((color) => String(color || "").trim())
    .filter(Boolean);

  if (adminColors.length) {
    const seen = new Set();
    return adminColors
      .filter((color) => {
        const key = color.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(resolveProductColorInfo);
  }

  const name = String(product?.name || "");
  const matched = getKnownProductColors().find((item) => name.toUpperCase().includes(item.key));
  return [matched ? { ...matched } : resolveProductColorInfo("")];
}

function getProductColorInfo(product) {
  return getProductColorOptions(product)[0] || resolveProductColorInfo("");
}

function getProductSizeOptions(product) {
  const adminSizes = Array.isArray(product?.sizes)
    ? product.sizes.map((size) => String(size || "").trim()).filter(Boolean)
    : [];
  if (adminSizes.length) {
    const seen = new Set();
    return adminSizes.filter((size) => {
      const key = size.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const name = String(product?.name || "").toUpperCase();
  const category = String(product?.category || "all").toLowerCase();
  if (category === "accessories" || name.includes("SOCK") || name.includes("BEANIE") || name.includes("TRUNKERS")) {
    return ["One size"];
  }
  return ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
}

function getProductSku(product) {
  const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  const variantSku = Array.isArray(product?.variants)
    ? product.variants.find((variant) => String(variant?.sku || "").trim())?.sku
    : "";
  const savedSku = String(product?.sku || metadata?.sku || variantSku || "").trim();
  if (savedSku) return savedSku;

  const id = String(product?.productId || product?.id || "").trim();
  if (!id) return "BLX";
  if (/^BLX-/i.test(id)) return id.toUpperCase();
  if (/^\d+$/.test(id)) return `BLX-${id.padStart(3, "0")}`;
  return `BLX-${id.toUpperCase()}`;
}

function toCartItemFromProduct(product, qty, options) {
  const safeQty = Math.max(1, parseInt(String(qty || 1), 10));
  const selectedColorLabel = normalizeCartOptionLabel(options?.color, "Color", "Standard");
  const selectedSizeLabel = normalizeCartOptionLabel(options?.size, "Size", "M");
  const selectedColor = formatCartOptionLabel(selectedColorLabel, "Color", "Standard");
  const selectedSize = formatCartOptionLabel(selectedSizeLabel, "Size", "M");
  const priceNgn = Number(getProductDisplayPriceNgn(product) || 0);
  const regularPriceNgn = Number(product.priceNgn || 0);
  const stockQuantity = getProductStockQuantity(product);
  const item = {
    id: String(product.id ?? ""),
    productId: String(product.id ?? ""),
    name: product.name || "Product",
    title: product.name || "Product",
    color: selectedColor,
    colorLabel: selectedColorLabel,
    size: selectedSize,
    sizeLabel: selectedSizeLabel,
    image: product.images?.[0] || "",
    alt: product.name || "Product",
    category: product.category || "all",
    categoryId: product.category || "all",
    qty: safeQty,
    quantity: safeQty,
    price: priceNgn,
    priceNgn,
    regularPriceNgn,
    discountPriceNgn: getProductSalePriceNgn(product),
    stockQuantity,
    availableStock: stockQuantity
  };

  item.variantId = options?.variantId
    ? String(options.variantId)
    : window.BenzyCartStore?.buildVariantId
      ? window.BenzyCartStore.buildVariantId({ ...item, color: selectedColorLabel, size: selectedSizeLabel })
      : `${product.id}:${selectedSizeLabel}:${selectedColorLabel}`.toLowerCase().replace(/\s+/g, "-");

  return item;
}

function normalizeCartVariant(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCartOptionLabel(value, prefix, fallback) {
  const raw = String(value || "").trim();
  const cleanPrefix = String(prefix || "").trim();
  const pattern = cleanPrefix ? new RegExp(`^${cleanPrefix}\\s*:\\s*`, "i") : null;
  const cleaned = pattern ? raw.replace(pattern, "").trim() : raw;
  return cleaned || fallback;
}

function formatCartOptionLabel(value, prefix, fallback) {
  const label = normalizeCartOptionLabel(value, prefix, fallback);
  return `${prefix}: ${label}`;
}

async function addProductToCart(product, qty, options) {
  if (!product) return false;
  const image = product.images?.[0] || "";
  if (!image) return false;
  const stockQuantity = getProductStockQuantity(product);
  const requestedQty = Math.max(1, parseInt(String(qty || 1), 10));
  if (stockQuantity <= 0) {
    window.BenzyCartStore?.showToast?.("This product is currently out of stock. Please choose another product.", "error");
    return false;
  }
  if (requestedQty > stockQuantity) {
    window.BenzyCartStore?.showToast?.(
      `Only ${stockQuantity} ${stockQuantity === 1 ? "piece is" : "pieces are"} left in stock. Please proceed with ${stockQuantity} or choose another product.`,
      "error"
    );
    qty = stockQuantity;
  }

  const variantOptions = {
    color: formatCartOptionLabel(options?.color, "Color", "Standard"),
    size: formatCartOptionLabel(options?.size, "Size", "M")
  };

  const nextItem = toCartItemFromProduct(product, qty, variantOptions);

  if (window.BenzyCartStore?.addItem) {
    try {
      const currentItems = typeof window.BenzyCartStore.getCachedCart === "function"
        ? window.BenzyCartStore.getCachedCart()
        : [];
      const existing = Array.isArray(currentItems)
        ? currentItems.find((item) => {
            if (String(item.productId || "") !== String(nextItem.productId || "")) return false;
            return normalizeCartVariant(item.variantId) === normalizeCartVariant(nextItem.variantId);
          })
        : null;
      const existingQty = existing ? Math.max(1, parseInt(String(existing.quantity || existing.qty || 1), 10)) : 0;
      const nextQty = existingQty + Math.max(1, parseInt(String(nextItem.quantity || nextItem.qty || 1), 10));
      if (stockQuantity > 0 && nextQty > stockQuantity) {
        window.BenzyCartStore?.showToast?.(
          `Only ${stockQuantity} ${stockQuantity === 1 ? "piece is" : "pieces are"} left in stock. Please proceed with ${stockQuantity} or choose another product.`,
          "error"
        );
        if (existingQty >= stockQuantity) return false;
        nextItem.quantity = stockQuantity - existingQty;
        nextItem.qty = nextItem.quantity;
      }
      await window.BenzyCartStore.addItem(nextItem);
      return true;
    } catch (error) {
      window.BenzyCartStore?.showToast?.(error?.message || "Unable to add this item to your cart.", "error");
      return false;
    }
  }

  let cart = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    cart = Array.isArray(parsed) ? parsed : [];
  } catch {
    cart = [];
  }

  const safeQty = Math.max(1, parseInt(String(qty || 1), 10));
  const targetColor = normalizeCartVariant(variantOptions.color);
  const targetSize = normalizeCartVariant(variantOptions.size);
  const existing = cart.find(
    (item) =>
      item.title === product.name &&
      item.image === image &&
      normalizeCartVariant(item.color) === targetColor &&
      normalizeCartVariant(item.size) === targetSize
  );
  if (existing) {
    const nextQty = Math.max(1, parseInt(String(existing.qty || 1), 10)) + safeQty;
    if (stockQuantity > 0 && nextQty > stockQuantity) {
      window.BenzyCartStore?.showToast?.(
        `Only ${stockQuantity} ${stockQuantity === 1 ? "piece is" : "pieces are"} left in stock. Please proceed with ${stockQuantity} or choose another product.`,
        "error"
      );
      existing.qty = stockQuantity;
    } else {
      existing.qty = nextQty;
    }
    existing.quantity = existing.qty;
  } else {
    cart.push(nextItem);
  }

  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("benzy:cart-updated"));
  return true;
}

function getCardGlowFromImage(img) {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;
    canvas.width = 16;
    canvas.height = 16;
    context.drawImage(img, 0, 0, 16, 16);
    const pixels = context.getImageData(0, 0, 16, 16).data;

    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha < 80) continue;
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
      count += 1;
    }
    if (count === 0) return null;

    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count)
    };
  } catch {
    return null;
  }
}

function normalizeProductImages(product) {
  const explicitImages = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
  const images = explicitImages.length ? explicitImages : [product?.image1, product?.image2].filter(Boolean);
  return images
    .map((src) => normalizeProductImageUrl(src))
    .filter(Boolean)
    .filter((src, index, list) => list.indexOf(src) === index);
}

function normalizeProductImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const repaired = raw.replace(/(\/uploads\/products\/[^?#]+)\.(?=([?#]|$))/, "$1.webp");
  if (/^(https?:|data:|blob:)/i.test(repaired)) return repaired;
  const uploadPath = repaired.startsWith("/") ? repaired : `/${repaired.replace(/^\.?\/*/, "")}`;
  if (uploadPath.startsWith("/uploads/products/")) {
    return `${getProductApiBases()[0]}${uploadPath}`;
  }
  return repaired;
}

function escapeProductHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bindProductCardEffects(root) {
  const cards = root.querySelectorAll(".shop-card, .search-card");
  const mobileMediaQuery = window.matchMedia ? window.matchMedia("(hover: none), (pointer: coarse)") : null;
  cards.forEach((card) => {
    if (card.dataset.fxBound === "1") return;
    card.dataset.fxBound = "1";

    const media = card.querySelector(".product-card-media");
    if (!(media instanceof HTMLElement)) return;
    const mainImage = media.querySelector(".main-img");

    let images = [];
    try {
      const encoded = card.getAttribute("data-images") || "";
      images = JSON.parse(decodeURIComponent(encoded));
    } catch {
      images = [];
    }

    if (images[1]) {
      media.classList.add("has-secondary-image");
    }

    const hoverImage = media.querySelector(".hover-img");
    if (!(mainImage instanceof HTMLImageElement) || images.length < 2) return;

    const hoverImages = images.slice(1).filter(Boolean);
    let hoverIndex = 0;
    let hoverTimer = 0;
    let mobileIndex = 0;

    hoverImages.forEach(function (src) {
      const preload = new Image();
      preload.src = src;
    });

    function showHoverImage(index) {
      if (!(hoverImage instanceof HTMLImageElement)) return;
      if (!hoverImages.length) return;
      hoverIndex = ((index % hoverImages.length) + hoverImages.length) % hoverImages.length;
      const nextSrc = hoverImages[hoverIndex];
      if (nextSrc && hoverImage.src !== nextSrc) {
        hoverImage.src = nextSrc;
      }
    }

    function startHoverCycle() {
      if (!(hoverImage instanceof HTMLImageElement)) return;
      showHoverImage(0);
      if (hoverImages.length < 2 || hoverTimer) return;
      hoverTimer = window.setInterval(function () {
        showHoverImage(hoverIndex + 1);
      }, 850);
    }

    function stopHoverCycle() {
      if (hoverTimer) {
        window.clearInterval(hoverTimer);
        hoverTimer = 0;
      }
      showHoverImage(0);
    }

    function isCoarsePointer() {
      return mobileMediaQuery ? mobileMediaQuery.matches : false;
    }

    function resetMobileImage(restorePrimary) {
      if (restorePrimary && images[0]) {
        mobileIndex = 0;
        mainImage.src = images[0];
      }
      media.classList.remove("is-touch-selected");
    }

    function showMobileImage(index) {
      if (!images.length) return;
      mobileIndex = ((index % images.length) + images.length) % images.length;
      const nextSrc = images[mobileIndex];
      if (nextSrc && mainImage.getAttribute("src") !== nextSrc) {
        mainImage.src = nextSrc;
      }
    }

    function handleManualMobileSwap(event) {
      if (!isCoarsePointer() || images.length < 2) return;
      if (event.target instanceof HTMLElement && event.target.closest(".product-quick-view")) return;
      event.preventDefault();
      event.stopPropagation();
      media.classList.add("is-touch-selected");
      showMobileImage(mobileIndex + 1);
    }

    card.addEventListener("mouseenter", startHoverCycle);
    card.addEventListener("mouseleave", stopHoverCycle);
    card.addEventListener("focusin", startHoverCycle);
    card.addEventListener("focusout", stopHoverCycle);
    media.addEventListener("click", handleManualMobileSwap);

    if (mobileMediaQuery?.addEventListener) {
      mobileMediaQuery.addEventListener("change", function () {
        if (!isCoarsePointer()) resetMobileImage(true);
      });
    } else if (mobileMediaQuery?.addListener) {
      mobileMediaQuery.addListener(function () {
        if (!isCoarsePointer()) resetMobileImage(true);
      });
    }
  });
}

function productToCardHtml(product, cardClass) {
  const images = normalizeProductImages(product);
  const primaryImage = images[0] || "/OFF BACK/BLX.png";
  const secondaryImage = images[1] || "";
  const hasSecondaryImage = Boolean(secondaryImage && secondaryImage !== primaryImage);
  const displayPriceNgn = getProductDisplayPriceNgn(product);
  const priceUsd = convertPriceFromNgn(Number(displayPriceNgn || 0), "USD");
  const categoryTags = productCategoryTags(product);
  const imagesEncoded = encodeURIComponent(JSON.stringify(images));
  const safeId = escapeProductHtml(product.id);
  const safeName = escapeProductHtml(product.name);
  const safeCategoryTags = escapeProductHtml(categoryTags);
  const safePrimaryImage = escapeProductHtml(primaryImage);
  const safeSecondaryImage = escapeProductHtml(secondaryImage);
  const safeSku = escapeProductHtml(getProductSku(product));

  const stockText = isProductInStock(product) ? "In stock" : "Out of stock";
  const stockClass = isProductInStock(product) ? "stock-in" : "stock-out";

  return `
    <article class="${cardClass}" data-id="${safeId}" data-sku="${safeSku}" data-name="${safeName}" data-category="${safeCategoryTags}" data-price-ngn="${Number(displayPriceNgn || 0)}" data-price-usd="${priceUsd.toFixed(2)}" data-images="${imagesEncoded}">
      <div class="product-card-media${hasSecondaryImage ? " has-secondary-image" : ""}">
        <button class="product-quick-view" type="button">Quick View</button>
        <img class="product-card-image main-img" src="${safePrimaryImage}" alt="${safeName}" loading="lazy" decoding="async" />
        ${hasSecondaryImage
          ? `<img class="product-card-image hover-img" src="${safeSecondaryImage}" alt="" loading="lazy" decoding="async" aria-hidden="true" />`
          : ""}
      </div>
      <h3>${safeName}</h3>
      <p class="product-price${getProductSalePriceNgn(product) ? " is-sale" : ""}">${formatProductPriceHtml(product)}</p>
      <p class="product-stock ${stockClass}">${stockText}</p>
    </article>
  `;
}

(function () {
  const shopCurrencySelect = document.getElementById("shop-currency-select");
  if (!(shopCurrencySelect instanceof HTMLSelectElement)) return;

  shopCurrencySelect.value = getActiveCurrencyCode();
  shopCurrencySelect.addEventListener("change", function () {
    const service = getCurrencyService();
    if (service?.setSelectedCurrency) {
      service.setSelectedCurrency(shopCurrencySelect.value);
      return;
    }

    localStorage.setItem(CURRENCY_KEY, shopCurrencySelect.value);
    window.dispatchEvent(new CustomEvent("benzy:currency-updated"));
  });
})();

(async function () {
  const input = document.getElementById("product-search");
  const empty = document.getElementById("search-empty");
  const results = document.getElementById("search-results");
  const meta = document.getElementById("search-meta");
  const historyWrap = document.getElementById("search-history");
  const historyList = document.getElementById("history-list");
  const clearHistoryBtn = document.getElementById("clear-history");
  const clearSearchBtn = document.getElementById("clear-search");
  const presetButtons = document.querySelectorAll("[data-search-term]");
  const HISTORY_KEY = "benzy_search_history";
  const HISTORY_LIMIT = 8;
  const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
  const SEARCH_PARAM = "q";

  if (!input || !empty || !results) return;
  await BENZY_PRODUCTS_READY;

  function renderSearchProducts() {
    results.innerHTML = BENZY_PRODUCTS
      .map((product) => productToCardHtml(product, "search-card"))
      .join("");
    bindProductCardEffects(results);
  }

  renderSearchProducts();

  function getCards() {
    return results.querySelectorAll(".search-card");
  }

  function getInitialQuery() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get(SEARCH_PARAM) || "").trim();
  }

  function updateSearchUrl(query) {
    if (!window.history || typeof window.history.replaceState !== "function") return;

    const url = new URL(window.location.href);
    const trimmed = String(query || "").trim();

    if (trimmed) {
      url.searchParams.set(SEARCH_PARAM, trimmed);
    } else {
      url.searchParams.delete(SEARCH_PARAM);
    }

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function normalizeHistory(raw) {
    const now = Date.now();

    if (!Array.isArray(raw)) return [];

    return raw
      .map((item) => {
        if (typeof item === "string") return { term: item.toLowerCase(), ts: now };
        if (item && typeof item.term === "string" && typeof item.ts === "number") {
          return { term: item.term.toLowerCase(), ts: item.ts };
        }
        return null;
      })
      .filter(Boolean)
      .filter((item) => now - item.ts <= HISTORY_TTL_MS);
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const normalized = normalizeHistory(parsed);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(normalized));
      return normalized;
    } catch {
      return [];
    }
  }

  function addToHistory(term) {
    const cleaned = term.trim().toLowerCase();
    if (!cleaned) return;

    const existing = loadHistory().filter((item) => item.term !== cleaned);
    const next = [{ term: cleaned, ts: Date.now() }, ...existing].slice(0, HISTORY_LIMIT);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    renderHistory();
  }

  function runSearch(query, options) {
    const settings = options && typeof options === "object" ? options : {};
    const trimmed = String(query || "").trim();
    const normalized = trimmed.toLowerCase();
    const totalCards = getCards().length;

    if (clearSearchBtn) clearSearchBtn.hidden = !normalized;
    if (settings.syncUrl !== false) updateSearchUrl(trimmed);

    if (!normalized) {
      results.hidden = totalCards === 0;
      empty.hidden = true;
      if (meta) {
        meta.textContent = totalCards === 0
          ? "No products are available right now."
          : `Showing all ${totalCards} product${totalCards === 1 ? "" : "s"}. Start typing to narrow it down.`;
      }
      getCards().forEach((card) => {
        card.style.display = "";
      });
      return;
    }

    results.hidden = false;

    let visible = 0;
    getCards().forEach((card) => {
      const name = (card.dataset.name || "").toLowerCase();
      const category = (card.dataset.category || "").toLowerCase();
      const show = name.includes(normalized) || category.includes(normalized);
      card.style.display = show ? "" : "none";
      if (show) visible += 1;
    });

    results.hidden = visible === 0;
    empty.hidden = visible !== 0;
    if (meta) {
      meta.textContent = visible === 0
        ? `No results for "${trimmed}".`
        : `Showing ${visible} result${visible > 1 ? "s" : ""} for "${trimmed}".`;
    }
  }

  function applySearch(term, options) {
    const settings = options && typeof options === "object" ? options : {};
    const nextTerm = String(term || "").trim();
    input.value = nextTerm;
    runSearch(nextTerm, settings);
    if (settings.saveHistory) addToHistory(nextTerm);
    if (settings.focusInput) input.focus();
  }

  function renderHistory() {
    if (!historyWrap || !historyList) return;

    const items = loadHistory();
    historyList.innerHTML = "";

    if (!items.length) {
      historyWrap.hidden = true;
      return;
    }

    historyWrap.hidden = false;

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-chip";
      btn.textContent = item.term;
      btn.addEventListener("click", function () {
        applySearch(item.term, { focusInput: true });
      });
      historyList.appendChild(btn);
    });
  }

  input.addEventListener("input", function () {
    runSearch(input.value);
  });

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") addToHistory(input.value);
  });

  input.addEventListener("blur", function () {
    addToHistory(input.value);
  });

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", function () {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", function () {
      applySearch("", { focusInput: true });
    });
  }

  presetButtons.forEach((button) => {
    button.addEventListener("click", function () {
      applySearch(button.getAttribute("data-search-term") || "", {
        saveHistory: true,
        focusInput: true
      });
    });
  });

  renderHistory();
  const initialQuery = getInitialQuery();
  if (initialQuery) {
    applySearch(initialQuery, { syncUrl: false });
  } else {
    runSearch("", { syncUrl: false });
  }

  window.addEventListener("benzy:currency-updated", function () {
    const term = input.value;
    renderSearchProducts();
    runSearch(term, { syncUrl: false });
  });
})();

(async function () {
  const grid = document.getElementById("shop-grid");
  const empty = document.getElementById("shop-empty");
  const shopPage = document.querySelector(".shop-page");
  const shopHomeLanding = document.getElementById("shop-home-landing");
  const shopCategoryShell = document.getElementById("shop-category-shell");
  const shopCategoryKicker = document.getElementById("shop-category-kicker");
  const shopCategoryBreadcrumb = document.getElementById("shop-category-breadcrumb");
  const shopCategoryTitle = document.getElementById("shop-category-title");
  const shopCategoryDescription = document.getElementById("shop-category-description");
  const shopCategoryFeatured = document.getElementById("shop-category-featured");
  const shopCategoryMetricCount = document.getElementById("shop-category-metric-count");
  const shopCategoryMetricPrice = document.getElementById("shop-category-metric-price");
  const shopCategoryMetricStock = document.getElementById("shop-category-metric-stock");
  const shopCategoryImage = document.getElementById("shop-category-image");
  const shopCategoryAccentTitle = document.getElementById("shop-category-accent-title");
  const shopCategoryAccentCopy = document.getElementById("shop-category-accent-copy");
  const shopCategoryNoteTitle = document.getElementById("shop-category-note-title");
  const shopCategoryNoteBody = document.getElementById("shop-category-note-body");
  const shopCategoryPalette = document.getElementById("shop-category-palette");
  const shopCategoryPaletteCopy = document.getElementById("shop-category-palette-copy");
  const shopCategoryStockTitle = document.getElementById("shop-category-stock-title");
  const shopCategoryStockBody = document.getElementById("shop-category-stock-body");
  const shopHomeNewInGrid = document.getElementById("shop-home-newin-grid");
  const shopHomeProductsGrid = document.getElementById("shop-home-products-grid");
  const shopHomeHeroImage = document.querySelector(".shop-home-video");
  const shopHomeHeroDots = document.getElementById("shop-home-hero-dots");
  const shopToolbar = document.querySelector(".shop-toolbar");
  const shopFilterSummary = document.getElementById("shop-filter-summary");
  const shopSortRow = document.querySelector(".shop-sort-row");
  const shopCurrencyInline = document.querySelector(".currency-inline");
  const filterPanel = document.querySelector(".shop-filters");
  const shopProductsCount = document.getElementById("shop-products-count");
  const sortSelect = document.getElementById("shop-sort-select");
  const shopLayout = document.querySelector(".shop-layout");
  const filterToggleBtn = document.getElementById("shop-filter-toggle");
  const filterCloseBtn = document.getElementById("shop-filter-close");
  const inStockInput = document.getElementById("filter-instock");
  const minInput = document.getElementById("filter-price-min");
  const maxInput = document.getElementById("filter-price-max");
  const minRange = document.getElementById("filter-range-min");
  const maxRange = document.getElementById("filter-range-max");
  const filterRangeWrap = document.querySelector(".filter-range-wrap");
  const currencyPrefixes = document.querySelectorAll(".currency-prefix");
  const priceNote = document.getElementById("filter-price-note");
  const resetBtn = document.getElementById("filter-reset");
  const validCats = ["all", "men", "women", "accessories"];
  const HOME_HERO_INTERVAL_MS = 4800;
  const CATEGORY_PAGE_META = {
    all: {
      kicker: "Complete Collection",
      description: "The full Benzy Luxury wardrobe, bringing statement jerseys, clean basics, and finishing accessories into one premium browse.",
      image: "Model shoot/IMG_0038.JPG",
      imageAlt: "Benzy Luxury complete collection",
      accentTitle: "The full BLX wardrobe",
      accentCopy: "Built for customers who want the entire line in one place, from everyday essentials to headline pieces.",
      noteTitle: "Luxury in motion",
      noteBody: "This collection is designed like a full rails presentation, so you can move from sport-coded layers to compact accessories without leaving the page."
    },
    men: {
      kicker: "Men's",
      description: "Strong silhouettes, athletic references, and bold branded graphics shape this men's collection into a sharper statement wardrobe.",
      image: "Model shoot/IMG_0054.JPG",
      imageAlt: "Benzy Luxury men's collection",
      accentTitle: "Structured street energy",
      accentCopy: "A focused run of jerseys, outerwear, and track-led pieces designed to feel elevated without losing edge.",
      noteTitle: "Cut for confident rotation",
      noteBody: "Expect high-contrast graphics, easy layering, and colorways that read strong on their own or even sharper as a styled set."
    },
    women: {
      kicker: "Women's",
      description: "The women's collection leans into lighter color stories, fitted basics, and expressive jersey silhouettes that still feel effortless.",
      image: "Model shoot/IMG_0002.JPG",
      imageAlt: "Benzy Luxury women's collection",
      accentTitle: "Soft tone, strong presence",
      accentCopy: "Curated for customers who want femininity, movement, and standout styling built into the same wardrobe.",
      noteTitle: "Designed for statement ease",
      noteBody: "This collection balances softer palettes with sport cues, making it easy to style the pieces casually or push them into a more editorial look."
    },
    accessories: {
      kicker: "Accessories",
      description: "Compact pieces with brand attitude, built to finish the look, sharpen styling, and bring the collection together with smaller details.",
      image: "Model shoot/IMG_9600.JPG",
      imageAlt: "Benzy Luxury accessories collection",
      accentTitle: "The finishing layer",
      accentCopy: "Socks, beanies, and extras that add contrast, color, and depth without competing with the main fit.",
      noteTitle: "Small pieces, clear identity",
      noteBody: "These accessories are curated to work as accent pieces, letting customers complete a look quickly while still keeping the BLX signature visible."
    }
  };
  const homeHeroImages = [
    "Model shoot/IMG_0038.JPG",
    "Model shoot/IMG_9617.JPG",
    "Model shoot/IMG_9591.JPG",
    "Model shoot/IMG_9604.JPG",
    "Model shoot/IMG_9630.JPG",
    "Model shoot/IMG_9722.JPG",
    "Model shoot/IMG_0024.JPG",
    "Model shoot/IMG_9997.JPG"
  ];
  homeHeroImages.forEach((src) => {
    const image = new Image();
    image.src = src;
  });
  if (!grid) return;
  await BENZY_PRODUCTS_READY;

  let activeCat = "";
  let activeFilterCurrency = "";
  let homeHeroTimer = 0;
  let homeHeroIndex = 0;

  if (shopHomeLanding instanceof HTMLElement) {
    shopHomeLanding.style.setProperty("--shop-hero-slide-ms", `${HOME_HERO_INTERVAL_MS}ms`);
  }

  function categoryLabel(cat) {
    const labels = {
      all: "All Products",
      men: "Men",
      women: "Women",
      accessories: "Accessories"
    };
    return labels[cat] || "All Products";
  }

  function escapeShopHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getSortLabel(sortMode) {
    const labels = {
      featured: "featured first",
      "best-selling": "best selling first",
      az: "A to Z",
      za: "Z to A",
      "price-asc": "lowest price first",
      "price-desc": "highest price first",
      "date-old-new": "oldest first",
      "date-new-old": "newest first"
    };
    return labels[sortMode] || "featured first";
  }

  function getCategoryMeta(cat) {
    return CATEGORY_PAGE_META[cat] || CATEGORY_PAGE_META.all;
  }

  function buildCategoryPalette(items) {
    const counts = new Map();

    items.forEach((product) => {
      getProductColorOptions(product).forEach((color) => {
      const key = `${color.label}|${color.hex}|${color.border}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { ...color, count: 1 });
      });
    });

    return [...counts.values()]
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 4);
  }

  function renderCategoryShell(cat, items, currencyCode, minPrice, maxPrice) {
    if (!(shopCategoryShell instanceof HTMLElement)) return;

    shopCategoryShell.dataset.category = cat;

    const meta = getCategoryMeta(cat);
    const inStockCount = items.filter((product) => isProductInStock(product)).length;
    const palette = buildCategoryPalette(items);
    const featuredProducts = [...items]
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, 4);

    if (shopCategoryKicker) shopCategoryKicker.textContent = meta.kicker;
    if (shopCategoryBreadcrumb) shopCategoryBreadcrumb.textContent = `Shop / ${categoryLabel(cat)}`;
    if (shopCategoryTitle) shopCategoryTitle.textContent = categoryLabel(cat);
    if (shopCategoryDescription) shopCategoryDescription.textContent = meta.description;
    if (shopCategoryMetricCount) {
      shopCategoryMetricCount.textContent = items.length ? items.length.toLocaleString() : "0";
    }
    if (shopCategoryMetricPrice) {
      shopCategoryMetricPrice.textContent = items.length
        ? `${formatCurrencyByCode(minPrice, currencyCode)} - ${formatCurrencyByCode(maxPrice, currencyCode)}`
        : "Unavailable";
    }
    if (shopCategoryMetricStock) {
      shopCategoryMetricStock.textContent = items.length
        ? `${inStockCount}/${items.length} READY NOW`
        : "No stock";
    }
    if (shopCategoryImage instanceof HTMLImageElement) {
      shopCategoryImage.src = meta.image;
      shopCategoryImage.alt = meta.imageAlt;
    }
    if (shopCategoryAccentTitle) shopCategoryAccentTitle.textContent = meta.accentTitle;
    if (shopCategoryAccentCopy) shopCategoryAccentCopy.textContent = meta.accentCopy;
    if (shopCategoryNoteTitle) shopCategoryNoteTitle.textContent = meta.noteTitle;
    if (shopCategoryNoteBody) shopCategoryNoteBody.textContent = meta.noteBody;

    if (shopCategoryFeatured) {
      shopCategoryFeatured.innerHTML = featuredProducts.length
        ? featuredProducts.map((product) => `<span class="shop-category-feature-pill">${escapeShopHtml(product.name)}</span>`).join("")
        : `<span class="shop-category-feature-pill is-muted">New pieces will appear here as products are added.</span>`;
    }

    if (shopCategoryPalette) {
      shopCategoryPalette.innerHTML = palette.length
        ? palette.map((color) => `
            <span class="shop-category-swatch">
              <i style="--swatch-fill:${color.hex};--swatch-border:${color.border};"></i>
              ${escapeShopHtml(color.label)}
            </span>
          `).join("")
        : `<span class="shop-category-swatch is-empty">Neutral</span>`;
    }

    if (shopCategoryPaletteCopy) {
      shopCategoryPaletteCopy.textContent = palette.length
        ? `Most visible across this collection: ${palette.map((color) => color.label).join(", ")}.`
        : "Palette details will appear as products are added to this collection.";
    }

    if (shopCategoryStockTitle) {
      if (!items.length) {
        shopCategoryStockTitle.textContent = "Collection is empty";
      } else if (inStockCount === items.length) {
        shopCategoryStockTitle.textContent = "Every piece is ready now";
      } else {
        shopCategoryStockTitle.textContent = `${inStockCount} pieces currently in stock`;
      }
    }

    if (shopCategoryStockBody) {
      if (!items.length) {
        shopCategoryStockBody.textContent = "Add products to start building this category page.";
      } else if (inStockCount === items.length) {
        shopCategoryStockBody.textContent = "Customers can browse this collection without hitting stock friction right now.";
      } else {
        const unavailable = Math.max(items.length - inStockCount, 0);
        shopCategoryStockBody.textContent = `${unavailable} ${unavailable === 1 ? "piece is" : "pieces are"} currently unavailable, so the collection still shows what is live first.`;
      }
    }

  }

  function updateFilterSummary(cat, currencyCode, options) {
    if (!(shopFilterSummary instanceof HTMLElement)) return;

    const summaryParts = [categoryLabel(cat)];
    const isPriceFiltered = options.minSelectedActive > options.minBoundActive || options.maxSelectedActive < options.maxBoundActive;

    if (options.inStockOnly) summaryParts.push("in stock only");
    if (isPriceFiltered) {
      summaryParts.push(`${formatCurrencyByCode(options.minSelectedActive, currencyCode)} to ${formatCurrencyByCode(options.maxSelectedActive, currencyCode)}`);
    }
    if (options.sortMode !== "featured") {
      summaryParts.push(`sorted ${getSortLabel(options.sortMode)}`);
    }

    shopFilterSummary.textContent = summaryParts.join(" | ");
  }

  function getRequestedCategory() {
    const params = new URLSearchParams(window.location.search);
    const cat = (params.get("cat") || "").toLowerCase();
    return validCats.includes(cat) ? cat : "";
  }

  function syncFilterRangeVisual(minSelectedActive, maxSelectedActive, minBoundActive, maxBoundActive) {
    if (!(filterRangeWrap instanceof HTMLElement)) return;

    const span = Math.max(maxBoundActive - minBoundActive, 0);
    if (span <= 0) {
      filterRangeWrap.style.setProperty("--range-start", "0%");
      filterRangeWrap.style.setProperty("--range-width", "100%");
      return;
    }

    const start = ((minSelectedActive - minBoundActive) / span) * 100;
    const end = ((maxSelectedActive - minBoundActive) / span) * 100;
    const clampedStart = Math.max(0, Math.min(start, 100));
    const clampedEnd = Math.max(clampedStart, Math.min(end, 100));

    filterRangeWrap.style.setProperty("--range-start", `${clampedStart}%`);
    filterRangeWrap.style.setProperty("--range-width", `${clampedEnd - clampedStart}%`);
  }

  function shuffleProducts(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function getProductFreshnessTime(product) {
    const createdTime = Date.parse(String(product?.createdAt || ""));
    if (Number.isFinite(createdTime)) return createdTime;

    const updatedTime = Date.parse(String(product?.updatedAt || ""));
    if (Number.isFinite(updatedTime)) return updatedTime;

    const numericId = Number(product?.id);
    return Number.isFinite(numericId) ? numericId : 0;
  }

  function isNewCollectionProduct(product) {
    const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
    const collectionText = [
      product?.collection,
      product?.collectionName,
      product?.categoryName,
      metadata.collection,
      metadata.collectionName
    ].map((value) => String(value || "").toLowerCase()).join(" ");

    return product?.newIn === true
      || product?.isNew === true
      || product?.featured === true
      || metadata.newIn === true
      || metadata.isNew === true
      || metadata.newCollection === true
      || metadata.featured === true
      || collectionText.includes("new collection")
      || collectionText.includes("new in");
  }

  function renderShopHomeGrids() {
    const byNewest = [...BENZY_PRODUCTS].sort((a, b) => getProductFreshnessTime(b) - getProductFreshnessTime(a));
    const curatedNewIn = byNewest.filter(isNewCollectionProduct);
    const newInPool = curatedNewIn.length >= 4 ? curatedNewIn : byNewest.slice(0, Math.max(4, Math.min(8, byNewest.length)));
    const newIn = shuffleProducts(newInPool).slice(0, 4);
    const allProducts = shuffleProducts(BENZY_PRODUCTS);

    if (shopHomeNewInGrid) {
      shopHomeNewInGrid.innerHTML = newIn.map((product) => productToCardHtml(product, "shop-card")).join("");
      bindProductCardEffects(shopHomeNewInGrid);
    }

    if (shopHomeProductsGrid) {
      shopHomeProductsGrid.innerHTML = allProducts.map((product) => productToCardHtml(product, "shop-card")).join("");
      bindProductCardEffects(shopHomeProductsGrid);
    }
  }

  function setHomeHeroImage(index) {
    if (!(shopHomeHeroImage instanceof HTMLImageElement)) return;
    const safeIndex = ((index % homeHeroImages.length) + homeHeroImages.length) % homeHeroImages.length;
    const nextSrc = homeHeroImages[safeIndex];
    if (!nextSrc) return;
    homeHeroIndex = safeIndex;
    shopHomeHeroImage.style.opacity = "0.55";
    const nextImage = new Image();
    nextImage.onload = function () {
      shopHomeHeroImage.src = nextSrc;
      shopHomeHeroImage.style.opacity = "1";
    };
    nextImage.onerror = function () {
      shopHomeHeroImage.style.opacity = "1";
    };
    nextImage.src = nextSrc;
    syncHomeHeroDots();
    syncHomeHeroCta();
  }

  function syncHomeHeroCta() {
    const heroContent = document.querySelector(".shop-home-content");
    const ghostCta = document.querySelector('[data-hero-btn="ghost"]');
    const solidCta = document.querySelector('[data-hero-btn="solid"]');
    if (!(heroContent instanceof HTMLElement)) return;
    if (!(ghostCta instanceof HTMLAnchorElement)) return;
    if (!(solidCta instanceof HTMLAnchorElement)) return;
    if (!homeHeroImages.length) return;
    const isFirstSlide = homeHeroIndex === 0;
    const isLastSlide = homeHeroIndex === homeHeroImages.length - 1;
    const isMiddleSlide = !isFirstSlide && !isLastSlide;

    heroContent.classList.toggle("is-slide-first", isFirstSlide);
    heroContent.classList.toggle("is-slide-last", isLastSlide);
    heroContent.classList.toggle("is-slide-middle", isMiddleSlide);

    const showGhost = isFirstSlide;
    const showSolid = isFirstSlide || isLastSlide;

    ghostCta.setAttribute("aria-hidden", showGhost ? "false" : "true");
    ghostCta.tabIndex = showGhost ? 0 : -1;

    solidCta.setAttribute("aria-hidden", showSolid ? "false" : "true");
    solidCta.tabIndex = showSolid ? 0 : -1;
  }

  function syncHomeHeroDots() {
    if (!(shopHomeHeroDots instanceof HTMLElement)) return;
    const dots = shopHomeHeroDots.querySelectorAll(".shop-home-hero-dot");
    dots.forEach((dot, idx) => {
      const isActive = idx === homeHeroIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  function buildHomeHeroDots() {
    if (!(shopHomeHeroDots instanceof HTMLElement)) return;
    if (!homeHeroImages.length) return;
    shopHomeHeroDots.innerHTML = "";

    homeHeroImages.forEach((_, idx) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "shop-home-hero-dot";
      dot.setAttribute("aria-label", `Go to slide ${idx + 1}`);
      dot.addEventListener("click", function () {
        setHomeHeroImage(idx);
        restartHomeHeroRotation();
      });
      shopHomeHeroDots.appendChild(dot);
    });

    syncHomeHeroDots();
  }

  function stopHomeHeroRotation() {
    if (homeHeroTimer) {
      window.clearInterval(homeHeroTimer);
      homeHeroTimer = 0;
    }
  }

  function startHomeHeroRotation() {
    if (!(shopHomeHeroImage instanceof HTMLImageElement)) return;
    if (homeHeroImages.length < 2) return;
    if (homeHeroTimer) return;
    shopHomeHeroImage.style.transition = "opacity 0.44s ease";
    setHomeHeroImage(homeHeroIndex);
    homeHeroTimer = window.setInterval(function () {
      homeHeroIndex = (homeHeroIndex + 1) % homeHeroImages.length;
      setHomeHeroImage(homeHeroIndex);
    }, HOME_HERO_INTERVAL_MS);
  }

  function restartHomeHeroRotation() {
    stopHomeHeroRotation();
    startHomeHeroRotation();
  }

  function setShopMode(activeCategory) {
    const isHomeMode = !activeCategory;
    document.body.classList.toggle("shop-page-nav", isHomeMode);
    document.body.classList.toggle("shop-home-mode", isHomeMode);
    document.body.classList.toggle("shop-collection-mode", !isHomeMode);
    if (shopPage) shopPage.classList.toggle("shop-home-mode", isHomeMode);
    if (shopPage) shopPage.classList.toggle("shop-collection-mode", !isHomeMode);

    if (shopHomeLanding) {
      if (isHomeMode) shopHomeLanding.removeAttribute("hidden");
      else shopHomeLanding.setAttribute("hidden", "");
    }

    if (shopCategoryShell) {
      if (isHomeMode) shopCategoryShell.setAttribute("hidden", "");
      else shopCategoryShell.removeAttribute("hidden");
    }

    if (isHomeMode) {
      closeFilters();
      grid.innerHTML = "";
      if (filterPanel) filterPanel.setAttribute("hidden", "");
      if (shopLayout) shopLayout.setAttribute("hidden", "");
      if (shopToolbar) shopToolbar.setAttribute("hidden", "");
      if (shopSortRow) shopSortRow.setAttribute("hidden", "");
      if (shopCurrencyInline) shopCurrencyInline.removeAttribute("hidden");
      if (shopProductsCount) shopProductsCount.textContent = "0 products";
      if (shopFilterSummary) shopFilterSummary.textContent = "Showing the full collection.";
      if (empty) empty.hidden = true;
      document.title = "Benzy Luxury | Shop";
      renderShopHomeGrids();
      buildHomeHeroDots();
      startHomeHeroRotation();
      return;
    }

    stopHomeHeroRotation();
    if (shopLayout) shopLayout.removeAttribute("hidden");
    if (shopToolbar) shopToolbar.removeAttribute("hidden");
    if (shopSortRow) shopSortRow.removeAttribute("hidden");
    if (shopCurrencyInline) shopCurrencyInline.removeAttribute("hidden");
    if (filterPanel) filterPanel.removeAttribute("hidden");
  }

  function renderShopProducts() {
    const cat = getRequestedCategory();
    setShopMode(cat);
    if (!cat) return;

    const currencyCode = getActiveCurrencyCode();
    const stepValue = 0.01;
    const toActive = (ngn) => convertPriceFromNgn(ngn, currencyCode);
    const fromActive = (activeValue) => convertAmountToNgn(activeValue, currencyCode);
    const normalize = (value) => Math.max(0, Math.round(Number(value || 0) * 100) / 100);
    const toDisplay = (value) => normalize(value).toFixed(2);

    const inCategoryItems = BENZY_PRODUCTS.filter((product) => productMatchesCategory(product, cat));
    const highestNgn = inCategoryItems.reduce((max, p) => Math.max(max, Number(getProductDisplayPriceNgn(p) || 0)), 0);
    const minBoundNgn = 0;
    const maxBoundNgn = Number.isFinite(highestNgn) ? highestNgn : 0;
    const minBoundActive = normalize(toActive(minBoundNgn));
    const maxBoundActive = normalize(toActive(maxBoundNgn));

    renderCategoryShell(cat, inCategoryItems, currencyCode, minBoundActive, maxBoundActive);

    const catChanged = activeCat !== cat;
    const currencyChanged = activeFilterCurrency !== currencyCode;
    activeCat = cat;
    activeFilterCurrency = currencyCode;

    currencyPrefixes.forEach((node) => {
      node.textContent = getCurrencySymbolForCode(currencyCode);
    });
    if (priceNote) {
      priceNote.textContent = maxBoundActive > minBoundActive
        ? `Collection range: ${formatCurrencyByCode(minBoundActive, currencyCode)} - ${formatCurrencyByCode(maxBoundActive, currencyCode)}`
        : `Collection price: ${formatCurrencyByCode(maxBoundActive, currencyCode)}`;
    }

    if (minInput) {
      minInput.min = toDisplay(minBoundActive);
      minInput.max = toDisplay(maxBoundActive);
      minInput.step = String(stepValue);
      if (catChanged || currencyChanged || minInput.value === "") minInput.value = toDisplay(minBoundActive);
    }
    if (maxInput) {
      maxInput.min = toDisplay(minBoundActive);
      maxInput.max = toDisplay(maxBoundActive);
      maxInput.step = String(stepValue);
      if (catChanged || currencyChanged || maxInput.value === "") maxInput.value = toDisplay(maxBoundActive);
    }
    if (minRange) {
      minRange.min = toDisplay(minBoundActive);
      minRange.max = toDisplay(maxBoundActive);
      minRange.step = String(stepValue);
      if (catChanged || currencyChanged || !minRange.value) minRange.value = toDisplay(minBoundActive);
    }
    if (maxRange) {
      maxRange.min = toDisplay(minBoundActive);
      maxRange.max = toDisplay(maxBoundActive);
      maxRange.step = String(stepValue);
      if (catChanged || currencyChanged || !maxRange.value) maxRange.value = toDisplay(maxBoundActive);
    }

    let minSelectedActive = minInput ? Number(minInput.value || minBoundActive) : minBoundActive;
    let maxSelectedActive = maxInput ? Number(maxInput.value || maxBoundActive) : maxBoundActive;
    if (Number.isNaN(minSelectedActive)) minSelectedActive = minBoundActive;
    if (Number.isNaN(maxSelectedActive)) maxSelectedActive = maxBoundActive;

    minSelectedActive = Math.max(minBoundActive, Math.min(minSelectedActive, maxBoundActive));
    maxSelectedActive = Math.max(minBoundActive, Math.min(maxSelectedActive, maxBoundActive));
    if (minSelectedActive > maxSelectedActive) {
      const swap = minSelectedActive;
      minSelectedActive = maxSelectedActive;
      maxSelectedActive = swap;
    }

    if (minInput) minInput.value = toDisplay(minSelectedActive);
    if (maxInput) maxInput.value = toDisplay(maxSelectedActive);
    if (minRange) minRange.value = toDisplay(minSelectedActive);
    if (maxRange) maxRange.value = toDisplay(maxSelectedActive);
    syncFilterRangeVisual(minSelectedActive, maxSelectedActive, minBoundActive, maxBoundActive);

    const minSelectedNgn = fromActive(minSelectedActive);
    const maxSelectedNgn = fromActive(maxSelectedActive);

    const inStockOnly = Boolean(inStockInput?.checked);

    const items = BENZY_PRODUCTS.filter((product) => {
      if (!productMatchesCategory(product, cat)) return false;
      if (inStockOnly && !isProductInStock(product)) return false;
      const productPriceNgn = getProductDisplayPriceNgn(product);
      if (productPriceNgn < minSelectedNgn) return false;
      if (productPriceNgn > maxSelectedNgn) return false;
      return true;
    });

    const sortedItems = [...items];
    const sortMode = sortSelect instanceof HTMLSelectElement ? sortSelect.value : "featured";
    if (sortMode === "best-selling") {
      sortedItems.sort((a, b) => getProductDisplayPriceNgn(b) - getProductDisplayPriceNgn(a));
    } else if (sortMode === "az") {
      sortedItems.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (sortMode === "za") {
      sortedItems.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
    } else if (sortMode === "price-asc") {
      sortedItems.sort((a, b) => getProductDisplayPriceNgn(a) - getProductDisplayPriceNgn(b));
    } else if (sortMode === "price-desc") {
      sortedItems.sort((a, b) => getProductDisplayPriceNgn(b) - getProductDisplayPriceNgn(a));
    } else if (sortMode === "date-old-new") {
      sortedItems.sort((a, b) => (a.id || 0) - (b.id || 0));
    } else if (sortMode === "date-new-old") {
      sortedItems.sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    const label = categoryLabel(cat);

    grid.innerHTML = sortedItems
      .map((product) => productToCardHtml(product, "shop-card"))
      .join("");
    bindProductCardEffects(grid);

    document.title = `Benzy Luxury | Shop - ${label}`;

    if (shopProductsCount) {
      shopProductsCount.textContent = `${sortedItems.length.toLocaleString()} products`;
    }

    updateFilterSummary(cat, currencyCode, {
      inStockOnly,
      minSelectedActive,
      maxSelectedActive,
      minBoundActive,
      maxBoundActive,
      sortMode
    });

    if (empty) {
      empty.textContent = `No pieces match the current filters in ${label}.`;
      empty.hidden = sortedItems.length !== 0;
    }
  }

  renderShopHomeGrids();
  buildHomeHeroDots();
  renderShopProducts();
  window.addEventListener("benzy:currency-updated", function () {
    renderShopHomeGrids();
    renderShopProducts();
  });

  function openFilters() {
    if (!shopLayout) return;
    shopLayout.classList.add("filters-open");
    document.body.classList.add("shop-filters-open");
    if (filterToggleBtn) filterToggleBtn.setAttribute("aria-expanded", "true");
  }

  function closeFilters() {
    if (!shopLayout) return;
    shopLayout.classList.remove("filters-open");
    document.body.classList.remove("shop-filters-open");
    if (filterToggleBtn) filterToggleBtn.setAttribute("aria-expanded", "false");
  }

  if (filterToggleBtn) {
    filterToggleBtn.addEventListener("click", function () {
      if (!shopLayout) return;
      if (shopLayout.classList.contains("filters-open")) closeFilters();
      else openFilters();
    });
  }

  if (filterCloseBtn) {
    filterCloseBtn.addEventListener("click", closeFilters);
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", renderShopProducts);
  }

  document.addEventListener("click", function (event) {
    if (!shopLayout || !shopLayout.classList.contains("filters-open")) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (filterPanel && filterPanel.contains(target)) return;
    if (filterToggleBtn && filterToggleBtn.contains(target)) return;
    closeFilters();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeFilters();
  });

  [inStockInput, minInput, maxInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", renderShopProducts);
    el.addEventListener("change", renderShopProducts);
  });

  [minRange, maxRange].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", function () {
      if (!minInput || !maxInput || !minRange || !maxRange) return;
      const minVal = Number(minRange.value);
      const maxVal = Number(maxRange.value);
      minInput.value = String(Math.min(minVal, maxVal));
      maxInput.value = String(Math.max(minVal, maxVal));
      renderShopProducts();
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (inStockInput) inStockInput.checked = false;
      if (minInput) minInput.value = "";
      if (maxInput) maxInput.value = "";
      if (minRange) minRange.value = "";
      if (maxRange) maxRange.value = "";
      renderShopProducts();
    });
  }
})();

(async function () {
  const page = document.getElementById("product-page");
  if (!page) return;
  await BENZY_PRODUCTS_READY;

  const titleEl = document.getElementById("product-title");
  const priceEl = document.getElementById("product-price");
  const stockEl = document.getElementById("product-stock");
  const mainImage = document.getElementById("product-main-image");
  const thumbs = document.getElementById("product-thumbs");
  const qtyInput = document.getElementById("product-qty");
  const qtyMinus = document.getElementById("product-qty-minus");
  const qtyPlus = document.getElementById("product-qty-plus");
  const addBtn = document.getElementById("product-add-cart");
  const buyBtn = document.getElementById("product-buy-now");
  const relatedGrid = document.getElementById("product-related");
  const metaEl = document.getElementById("product-meta");
  const colorLabel = document.getElementById("product-color-label");
  const backLink = document.getElementById("product-back-link");
  const kickerEl = document.getElementById("product-kicker");
  const skuBadgeEl = document.getElementById("product-sku-badge");
  const imageCountEl = document.getElementById("product-image-count");
  const galleryNoteEl = document.getElementById("product-gallery-note");
  const imageStageCountEl = document.getElementById("product-image-stage-count");
  const galleryModeEl = document.getElementById("product-gallery-mode");
  const mainImageCaptionEl = document.getElementById("product-main-image-caption");
  const collectionLabelEl = document.getElementById("product-collection-label");
  const statusChipEl = document.getElementById("product-status-chip");
  const descriptionEl = document.getElementById("product-description");
  const highlightColorEl = document.getElementById("product-highlight-color");
  const highlightStyleEl = document.getElementById("product-highlight-style");
  const highlightDeliveryEl = document.getElementById("product-highlight-delivery");
  const detailsBodyEl = document.getElementById("product-details-body");
  const shippingBodyEl = document.getElementById("product-shipping-body");
  const sizeBodyEl = document.getElementById("product-size-body");
  const sizeNoteEl = document.getElementById("product-size-note");
  const checkoutNoteEl = document.getElementById("product-checkout-note");
  const sizeRow = page.querySelector(".product-size-row");

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const product = getProductById(productId);
  if (!product) {
    page.innerHTML = `<section class="product-page-shell"><h1>Product not found</h1><p>Return to <a href="Shop.html">Shop</a>.</p></section>`;
    return;
  }

  let activeImage = product.images?.[0] || "";
  const inStock = isProductInStock(product);
  const stockLimit = getProductStockQuantity(product);
  let selectedColorInfo = getProductColorInfo(product);

  function getProductStockLimitMessage() {
    if (stockLimit <= 0) return "This product is currently out of stock. Please choose another product.";
    return `Only ${stockLimit} ${stockLimit === 1 ? "piece is" : "pieces are"} left in stock. Please proceed with ${stockLimit} or choose another product.`;
  }

  function syncProductQtyButtons() {
    const currentQty = qtyInput instanceof HTMLInputElement ? parseInt(qtyInput.value || "1", 10) : 1;
    if (qtyPlus instanceof HTMLButtonElement) {
      qtyPlus.disabled = !inStock || (stockLimit > 0 && currentQty >= stockLimit);
    }
    if (qtyMinus instanceof HTMLButtonElement) {
      qtyMinus.disabled = !inStock || currentQty <= 1;
    }
  }

  function clampProductQuantity(value, options = {}) {
    const requested = Math.max(1, parseInt(String(value || 1), 10) || 1);
    const capped = stockLimit > 0 ? Math.min(requested, stockLimit) : requested;
    if (qtyInput instanceof HTMLInputElement) {
      qtyInput.value = String(capped);
    }
    if (options.notify && capped < requested && checkoutNoteEl) {
      checkoutNoteEl.textContent = getProductStockLimitMessage();
    }
    syncProductQtyButtons();
    return capped;
  }

  function productCategoryLabel(cat) {
    const labels = {
      all: "All Products",
      men: "Men",
      women: "Women",
      accessories: "Accessories"
    };
    return labels[String(cat || "all").toLowerCase()] || "All Products";
  }

  function getProductStory(item, color) {
    const category = String(item?.category || "all").toLowerCase();
    const categoryText = productCategoryLabel(category);
    const name = String(item?.name || "");
    const colorLabel = String(color?.label || "Signature");
    const lowerColor = colorLabel.toLowerCase();
    const sizeOptions = getProductSizeOptions(item);

    if (category === "accessories") {
      return {
        kicker: "Finishing piece",
        collectionLabel: `${categoryText} / Everyday accent`,
        description: `The ${name.toLowerCase()} adds a compact BLX signature to the look, giving your rotation an easy finishing layer without overworking the outfit.`,
        style: "Built to finish the fit",
        delivery: "Fast dispatch in 3-5 working days",
        details: `Designed as an easy styling accent, this accessory keeps the Benzy Luxury identity visible while staying effortless to wear every day.`,
        shippingHtml: "- Standard shipping: 6 working days<br>- Express shipping: 3-5 working days<br>- Free returns within 7 days",
        sizeGuide: sizeOptions.length === 1 ? "This accessory is offered in a one-size format for easy styling." : "Choose the size that fits your preferred wear."
      };
    }

    if (name.toUpperCase().includes("TRACK")) {
      return {
        kicker: "Statement set piece",
        collectionLabel: `${categoryText} / Elevated sport fit`,
        description: `The ${name.toLowerCase()} blends branded energy with a cleaner silhouette, making it easy to wear as a headline piece or as part of a full coordinated look.`,
        style: "Sharp sport-led layering",
        delivery: "Ships in 3-6 working days",
        details: "This piece is built to carry a stronger visual presence while still staying practical enough for repeat wear through the week.",
        shippingHtml: "- Standard shipping: 6 working days<br>- Express shipping: 3-5 working days<br>- Free returns within 7 days",
        sizeGuide: "Choose your regular size for a clean fit, or size up if you want more room through the body."
      };
    }

    if (name.toUpperCase().includes("JACKET")) {
      return {
        kicker: "Outer layer",
        collectionLabel: `${categoryText} / Utility statement`,
        description: `This ${lowerColor} outer layer is designed to sharpen everyday styling with a stronger silhouette, branded attitude, and easy layering potential.`,
        style: "Layered and structured",
        delivery: "Ships in 3-6 working days",
        details: "A practical outer layer with enough presence to anchor the rest of the fit, whether styled open or worn as the main statement.",
        shippingHtml: "- Standard shipping: 6 working days<br>- Express shipping: 3-5 working days<br>- Free returns within 7 days",
        sizeGuide: "Stay true to size for a standard fit, or go one size up if you prefer a roomier layered look."
      };
    }

    if (name.toUpperCase().includes("TOP")) {
      return {
        kicker: "Core essential",
        collectionLabel: `${categoryText} / Everyday basic`,
        description: `The ${lowerColor} ${name.toLowerCase()} gives your wardrobe a cleaner BLX base layer that can be styled solo or paired under heavier statement pieces.`,
        style: "Minimal with clear branding",
        delivery: "Ships in 3-6 working days",
        details: "Made to be an easy everyday essential, this piece focuses on balance, wearability, and a polished branded finish.",
        shippingHtml: "- Standard shipping: 6 working days<br>- Express shipping: 3-5 working days<br>- Free returns within 7 days",
        sizeGuide: "True to size for a close everyday fit. Size up if you want a more relaxed silhouette."
      };
    }

    if (isJerseyProduct(item)) {
      return {
        kicker: "Signature jersey",
        collectionLabel: `${categoryText} / Match-day statement`,
        description: `The ${lowerColor} ${name.toLowerCase()} carries the strongest BLX identity through bold graphics, athletic references, and a silhouette that reads instantly on body.`,
        style: "Sport-coded statement wear",
        delivery: "Ships in 3-6 working days",
        details: "Designed to stand out immediately, this jersey balances graphic energy with everyday wearability for styled looks that still feel easy.",
        shippingHtml: "- Standard shipping: 6 working days<br>- Express shipping: 3-5 working days<br>- Free returns within 7 days",
        sizeGuide: "Choose your regular size for the intended fit. Size up for a looser, more oversized jersey look."
      };
    }

    return {
      kicker: "Collection piece",
      collectionLabel: `${categoryText} / Benzy Luxury`,
      description: `A curated BLX piece built to bring elevated branding, wearable structure, and easy styling into your daily rotation.`,
      style: "Designed for versatile styling",
      delivery: "Ships in 3-6 working days",
      details: "This product is designed to sit comfortably between statement dressing and everyday wear, making it easy to rotate often.",
      shippingHtml: "- Standard shipping: 6 working days<br>- Express shipping: 3-5 working days<br>- Free returns within 7 days",
      sizeGuide: "Choose your regular size for a standard fit."
    };
  }

  function renderSizeOptions() {
    if (!(sizeRow instanceof HTMLElement)) return;
    const sizeOptions = getProductSizeOptions(product);
    sizeRow.innerHTML = sizeOptions
      .map((size, index) => `<button type="button" class="product-size${index === 0 ? " active" : ""}">${size}</button>`)
      .join("");
    sizeRow.classList.toggle("is-single", sizeOptions.length === 1);
    page.classList.toggle("product-one-size", sizeOptions.length === 1);
  }

  function renderProductSwatches() {
    const swatchRow = page.querySelector(".product-swatch-row");
    if (!(swatchRow instanceof HTMLElement)) return;

    const colorOptions = getProductColorOptions(product);
    swatchRow.innerHTML = colorOptions
      .map((color, index) => `
        <button
          type="button"
          class="product-swatch${index === 0 ? " active" : ""}"
          style="background:${escapeProductHtml(color.hex)};border-color:${escapeProductHtml(color.border)}"
          data-color-label="${escapeProductHtml(color.label)}"
          data-color-hex="${escapeProductHtml(color.hex)}"
          data-color-border="${escapeProductHtml(color.border)}"
          aria-label="${escapeProductHtml(color.label)}"
          title="${escapeProductHtml(color.label)}"
        ></button>
      `)
      .join("");
  }

  function syncSelectedProductColorCopy() {
    const story = getProductStory(product, selectedColorInfo);
    if (colorLabel) colorLabel.textContent = `Color: ${selectedColorInfo.label}`;
    if (collectionLabelEl) collectionLabelEl.textContent = story.collectionLabel;
    if (descriptionEl) descriptionEl.textContent = story.description;
    if (highlightColorEl) highlightColorEl.textContent = selectedColorInfo.label;
    if (highlightStyleEl) highlightStyleEl.textContent = story.style;
    if (highlightDeliveryEl) highlightDeliveryEl.textContent = story.delivery;
    if (detailsBodyEl) detailsBodyEl.textContent = story.details;
    if (shippingBodyEl) shippingBodyEl.innerHTML = story.shippingHtml;
    if (sizeBodyEl) sizeBodyEl.textContent = story.sizeGuide;
  }

  function syncProductMediaMeta(images) {
    const safeImages = Array.isArray(images) && images.length ? images : [activeImage].filter(Boolean);
    const activeIndex = Math.max(0, safeImages.indexOf(activeImage));
    const viewNumber = safeImages.length ? activeIndex + 1 : 1;

    if (imageStageCountEl) {
      imageStageCountEl.textContent = `${viewNumber} / ${Math.max(safeImages.length, 1)}`;
    }
    if (galleryModeEl) {
      galleryModeEl.textContent = safeImages.length > 1 ? "Multiple views" : "Single view";
    }
    if (mainImageCaptionEl) {
      mainImageCaptionEl.textContent = safeImages.length > 1 ? `Look ${viewNumber}` : "Hero image";
    }
  }

  function renderThumbs() {
    if (!thumbs) return;
    thumbs.innerHTML = "";
    const images = Array.isArray(product.images) && product.images.length ? product.images : [activeImage].filter(Boolean);
    images.forEach((src, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `product-thumb ${src === activeImage ? "active" : ""}`;
      btn.setAttribute("aria-label", `View image ${index + 1}`);
      btn.innerHTML = `<img src="${src}" alt="${product.name} image ${index + 1}">`;
      btn.addEventListener("click", function () {
        activeImage = src;
        if (mainImage instanceof HTMLImageElement) mainImage.src = activeImage;
        renderThumbs();
      });
      thumbs.appendChild(btn);
    });
    syncProductMediaMeta(images);
  }

  function renderProductPage() {
    const categoryText = productCategoryLabel(product.category);
    const sku = getProductSku(product);
    const images = Array.isArray(product.images) && product.images.length ? product.images : [activeImage].filter(Boolean);
    const story = getProductStory(product, selectedColorInfo);
    const sizeOptions = getProductSizeOptions(product);

    if (titleEl) titleEl.textContent = product.name;
    if (priceEl) {
      priceEl.classList.toggle("is-sale", Boolean(getProductSalePriceNgn(product)));
      priceEl.innerHTML = formatProductPriceHtml(product);
    }
    if (stockEl) {
      stockEl.textContent = inStock && stockLimit > 0
        ? `${stockLimit} ${stockLimit === 1 ? "piece" : "pieces"} in stock`
        : "Out of stock";
      stockEl.className = inStock ? "product-detail-stock stock-in" : "product-detail-stock stock-out";
    }
    if (metaEl) metaEl.textContent = `${categoryText} collection | ${sku}`;
    if (colorLabel) colorLabel.textContent = `Color: ${selectedColorInfo.label}`;
    if (collectionLabelEl) collectionLabelEl.textContent = story.collectionLabel;
    if (descriptionEl) descriptionEl.textContent = story.description;
    if (highlightColorEl) highlightColorEl.textContent = selectedColorInfo.label;
    if (highlightStyleEl) highlightStyleEl.textContent = story.style;
    if (highlightDeliveryEl) highlightDeliveryEl.textContent = story.delivery;
    if (kickerEl) kickerEl.textContent = story.kicker;
    if (skuBadgeEl) skuBadgeEl.textContent = sku;
    if (imageCountEl) imageCountEl.textContent = `${images.length} ${images.length === 1 ? "image" : "images"}`;
    if (galleryNoteEl) {
      galleryNoteEl.hidden = images.length <= 1;
      galleryNoteEl.textContent = images.length > 1
        ? "Tap a thumbnail to switch the main image."
        : "";
    }
    if (statusChipEl) {
      statusChipEl.textContent = inStock ? "Ready to shop" : "Currently unavailable";
      statusChipEl.className = `product-status-chip ${inStock ? "is-in-stock" : "is-out-of-stock"}`;
    }
    if (backLink instanceof HTMLAnchorElement) {
      const targetCategory = String(product.category || "all").toLowerCase();
      backLink.href = `Shop.html?cat=${targetCategory}`;
      backLink.textContent = `Back to ${categoryText}`;
    }
    if (detailsBodyEl) detailsBodyEl.textContent = story.details;
    if (shippingBodyEl) shippingBodyEl.innerHTML = story.shippingHtml;
    if (sizeBodyEl) sizeBodyEl.textContent = story.sizeGuide;
    if (sizeNoteEl) {
      sizeNoteEl.textContent = sizeOptions.length === 1
        ? "This piece is offered in one size."
        : story.sizeGuide;
    }
    if (checkoutNoteEl) {
      checkoutNoteEl.textContent = inStock
        ? "Shipping and taxes are calculated at checkout."
        : "This product is currently unavailable for checkout.";
    }
    if (qtyInput instanceof HTMLInputElement) {
      qtyInput.min = "1";
      if (stockLimit > 0) qtyInput.max = String(stockLimit);
      else qtyInput.removeAttribute("max");
      clampProductQuantity(qtyInput.value);
    }
    syncProductQtyButtons();
    if (addBtn instanceof HTMLButtonElement) {
      addBtn.disabled = !inStock;
      addBtn.textContent = inStock ? "Add to cart" : "Sold out";
    }
    if (buyBtn instanceof HTMLButtonElement) {
      buyBtn.disabled = !inStock;
      buyBtn.textContent = inStock ? "Buy it now" : "Unavailable";
    }
    if (mainImage instanceof HTMLImageElement) {
      mainImage.src = activeImage;
      mainImage.alt = product.name;
    }
    document.title = `Benzy Luxury | ${product.name}`;
    renderProductSwatches();
    renderSizeOptions();
    renderThumbs();
  }

  function renderRelated() {
    if (!relatedGrid) return;
    const sameCategory = BENZY_PRODUCTS.filter((item) => item.id !== product.id && item.category === product.category);
    const sameColor = BENZY_PRODUCTS.filter((item) => item.id !== product.id && getProductColorInfo(item).label === selectedColorInfo.label);
    const sameType = isJerseyProduct(product)
      ? BENZY_PRODUCTS.filter((item) => item.id !== product.id && isJerseyProduct(item))
      : [];
    const pool = [...sameCategory, ...sameType, ...sameColor, ...BENZY_PRODUCTS.filter((item) => item.id !== product.id)];
    const seen = new Set();
    const related = pool.filter((item) => {
      const key = String(item.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 4);

    relatedGrid.innerHTML = related
      .map((item) => `
        <article class="product-related-card">
          <a href="Product.html?id=${item.id}">
            <img src="${item.images?.[0] || ""}" alt="${item.name}">
            <h4>${item.name}</h4>
            <p class="${getProductSalePriceNgn(item) ? "is-sale" : ""}">${formatProductPriceHtml(item)}</p>
          </a>
        </article>
      `)
      .join("");
  }

  if (addBtn) {
    addBtn.addEventListener("click", async function () {
      const qty = qtyInput instanceof HTMLInputElement ? clampProductQuantity(qtyInput.value, { notify: true }) : 1;
      const selectedSizeEl = page.querySelector(".product-size.active");
      const selectedSize = selectedSizeEl ? `Size: ${selectedSizeEl.textContent?.trim()}` : "Size: M";
      const ok = await addProductToCart(product, qty, { color: `Color: ${selectedColorInfo.label}`, size: selectedSize });
      if (!ok) return;
      addBtn.classList.add("is-adding");
      addBtn.classList.add("added");
      addBtn.textContent = "Added to cart";
      window.setTimeout(function () {
        addBtn.classList.remove("is-adding");
        addBtn.classList.remove("added");
        addBtn.textContent = "Add to cart";
      }, 900);
    });
  }

  if (buyBtn) {
    buyBtn.addEventListener("click", async function () {
      const qty = qtyInput instanceof HTMLInputElement ? clampProductQuantity(qtyInput.value, { notify: true }) : 1;
      const selectedSizeEl = page.querySelector(".product-size.active");
      const selectedSize = selectedSizeEl ? `Size: ${selectedSizeEl.textContent?.trim()}` : "Size: M";
      const ok = await addProductToCart(product, qty, { color: `Color: ${selectedColorInfo.label}`, size: selectedSize });
      if (!ok) return;
      window.location.href = "Cart.html";
    });
  }

  if (qtyInput instanceof HTMLInputElement) {
    qtyInput.addEventListener("input", function () {
      clampProductQuantity(qtyInput.value, { notify: true });
    });
  }

  if (qtyPlus && qtyInput instanceof HTMLInputElement) {
    qtyPlus.addEventListener("click", function () {
      const value = Math.max(1, parseInt(qtyInput.value || "1", 10)) + 1;
      clampProductQuantity(value, { notify: true });
    });
  }

  if (qtyMinus && qtyInput instanceof HTMLInputElement) {
    qtyMinus.addEventListener("click", function () {
      const value = Math.max(1, parseInt(qtyInput.value || "1", 10) - 1);
      clampProductQuantity(value);
    });
  }

  page.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const sizeBtn = target.closest(".product-size");
    if (sizeBtn) {
      const row = sizeBtn.closest(".product-size-row");
      if (row) row.querySelectorAll(".product-size").forEach((btn) => btn.classList.remove("active"));
      sizeBtn.classList.add("active");
      return;
    }

    const swatchBtn = target.closest(".product-swatch");
    if (swatchBtn) {
      const row = swatchBtn.closest(".product-swatch-row");
      if (row) row.querySelectorAll(".product-swatch").forEach((btn) => btn.classList.remove("active"));
      swatchBtn.classList.add("active");
      selectedColorInfo = {
        label: swatchBtn.getAttribute("data-color-label") || "Default",
        hex: swatchBtn.getAttribute("data-color-hex") || "#d0d0d0",
        border: swatchBtn.getAttribute("data-color-border") || "#9e9e9e"
      };
      syncSelectedProductColorCopy();
      return;
    }

    const accBtn = target.closest(".product-acc-toggle");
    if (accBtn) {
      const key = accBtn.getAttribute("data-acc-target");
      if (!key) return;
      const body = page.querySelector(`[data-acc-body="${key}"]`);
      const icon = accBtn.querySelector(".product-acc-icon");
      if (!body) return;
      const expanded = accBtn.getAttribute("aria-expanded") === "true";
      const next = !expanded;
      accBtn.setAttribute("aria-expanded", next ? "true" : "false");
      if (next) body.removeAttribute("hidden");
      else body.setAttribute("hidden", "");
      if (icon) icon.textContent = next ? "-" : "+";
    }
  });

  renderProductPage();
  renderRelated();
  window.addEventListener("benzy:currency-updated", function () {
    renderProductPage();
    renderRelated();
  });
})();

(function () {
  const CARD_SELECTOR = ".shop-card, .search-card";
  let modalProduct = null;

  function quickProductCategoryLabel(cat) {
    const labels = {
      all: "All Products",
      men: "Men",
      women: "Women",
      accessories: "Accessories"
    };
    return labels[String(cat || "all").toLowerCase()] || "All Products";
  }

  function getQuickViewCopy(product, colorInfo) {
    const name = String(product?.name || "This piece");
    const category = quickProductCategoryLabel(product?.category);
    const colorLabel = String(colorInfo?.label || "Signature");
    if (String(product?.category || "").toLowerCase() === "accessories") {
      return `${name} is a ${category.toLowerCase()} accent in ${colorLabel}, built to finish the look while keeping the BLX signature visible.`;
    }
    return `${name} is styled in ${colorLabel}, balanced for everyday luxury wear with the same BLX detail shown on the full product page.`;
  }

  function ensureQuickViewModal() {
    let modal = document.getElementById("quick-view-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "quick-view-modal";
    modal.className = "quick-view-modal";
    modal.setAttribute("hidden", "");
    modal.innerHTML = `
      <div class="quick-view-backdrop" data-role="close-modal"></div>
      <div class="quick-view-panel" role="dialog" aria-modal="true" aria-label="Quick view">
        <button class="quick-view-close" type="button" data-role="close-modal" aria-label="Close">x</button>
        <div class="quick-view-media-wrap">
          <div class="quick-view-media">
            <img id="quick-view-image" src="" alt="" />
          </div>
          <div id="quick-view-thumbs" class="quick-view-thumbs"></div>
        </div>
        <div class="quick-view-details">
          <div class="quick-view-topline">
            <p id="quick-view-collection" class="quick-view-eyebrow">Select options</p>
            <p id="quick-view-status-chip" class="quick-status-chip">In stock</p>
          </div>
          <h3 id="quick-view-title"></h3>
          <div class="quick-detail-grid">
            <p class="quick-k">Price</p><p id="quick-view-price" class="quick-v"></p>
            <p class="quick-k">Stock</p><p id="quick-view-stock" class="quick-v"></p>
            <p class="quick-k">SKU</p><p id="quick-view-sku" class="quick-v"></p>
            <p class="quick-k">Category</p><p id="quick-view-meta" class="quick-v"></p>
          </div>
          <p id="quick-view-copy" class="quick-view-copy">Crafted with premium materials and tailored for everyday luxury wear.</p>
          <div class="quick-option">
            <p id="quick-view-color-label">Color: Default</p>
            <div class="quick-swatch-row">
              <button type="button" class="quick-swatch active" aria-label="Default color"></button>
            </div>
          </div>
          <div class="quick-option">
            <p>Size</p>
            <div class="quick-size-row">
              <button type="button" class="quick-size active">S</button>
              <button type="button" class="quick-size">M</button>
              <button type="button" class="quick-size">L</button>
              <button type="button" class="quick-size">XL</button>
              <button type="button" class="quick-size">2XL</button>
              <button type="button" class="quick-size">3XL</button>
              <button type="button" class="quick-size">4XL</button>
            </div>
          </div>
          <label class="quick-view-qty-wrap">
            Quantity
            <div class="quick-view-qty-box">
              <button id="quick-qty-minus" type="button" class="quick-qty-btn">-</button>
              <input id="quick-view-qty" type="number" min="1" value="1" />
              <button id="quick-qty-plus" type="button" class="quick-qty-btn">+</button>
            </div>
          </label>
          <div class="quick-view-actions">
            <button id="quick-view-add" class="quick-view-add" type="button">Add to cart</button>
            <button id="quick-view-buy" class="quick-view-buy" type="button">Buy it now</button>
            <a id="quick-view-link" class="quick-view-link" href="Product.html">View full details</a>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function openQuickViewByCard(card) {
    const id = card.getAttribute("data-id");
    const product = getProductById(id);
    if (!product) return;
    let cardImages = [];
    try {
      const encodedImages = card.getAttribute("data-images") || "";
      cardImages = JSON.parse(decodeURIComponent(encodedImages));
    } catch {
      cardImages = [];
    }
    const quickProduct = Array.isArray(cardImages) && cardImages.filter(Boolean).length
      ? { ...product, images: cardImages.filter(Boolean) }
      : product;
    const cardSku = String(card.getAttribute("data-sku") || "").trim();
    if (cardSku) quickProduct.sku = cardSku;

    const modal = ensureQuickViewModal();
    const image = modal.querySelector("#quick-view-image");
    const thumbs = modal.querySelector("#quick-view-thumbs");
    const title = modal.querySelector("#quick-view-title");
    const meta = modal.querySelector("#quick-view-meta");
    const sku = modal.querySelector("#quick-view-sku");
    const price = modal.querySelector("#quick-view-price");
    const stock = modal.querySelector("#quick-view-stock");
    const colorLabel = modal.querySelector("#quick-view-color-label");
    const collection = modal.querySelector("#quick-view-collection");
    const statusChip = modal.querySelector("#quick-view-status-chip");
    const copy = modal.querySelector("#quick-view-copy");
    const link = modal.querySelector("#quick-view-link");
    const addBtn = modal.querySelector("#quick-view-add");
    const buyBtn = modal.querySelector("#quick-view-buy");
    const qtyInput = modal.querySelector("#quick-view-qty");
    const qtyMinus = modal.querySelector("#quick-qty-minus");
    const qtyPlus = modal.querySelector("#quick-qty-plus");
    const sizeRow = modal.querySelector(".quick-size-row");
    modalProduct = quickProduct;
    const productImages = normalizeProductImages(quickProduct);
    let activeImage = productImages[0] || "";

    let selectedColorInfo = getProductColorInfo(quickProduct);
    const colorOptions = getProductColorOptions(quickProduct);
    const categoryText = quickProductCategoryLabel(quickProduct.category);
    const inStock = isProductInStock(quickProduct);
    const stockLimit = getProductStockQuantity(quickProduct);

    if (image instanceof HTMLImageElement) {
      image.src = activeImage;
      image.alt = quickProduct.name || "Product";
    }
    if (title) title.textContent = quickProduct.name || "Product";
    if (collection) collection.textContent = `${categoryText} / Quick view`;
    if (meta) meta.textContent = `${categoryText} collection`;
    if (sku) sku.textContent = getProductSku(quickProduct);
    if (price) {
      price.classList.toggle("is-sale", Boolean(getProductSalePriceNgn(quickProduct)));
      price.innerHTML = formatProductPriceHtml(quickProduct);
    }
    if (copy) copy.textContent = getQuickViewCopy(quickProduct, selectedColorInfo);
    if (link instanceof HTMLAnchorElement) link.href = `Product.html?id=${quickProduct.id}`;
    if (stock) {
      stock.textContent = inStock && stockLimit > 0
        ? `${stockLimit} ${stockLimit === 1 ? "piece" : "pieces"} in stock`
        : "Out of stock";
      stock.className = inStock ? "quick-v quick-stock stock-in" : "quick-v quick-stock stock-out";
    }
    if (statusChip) {
      statusChip.textContent = inStock ? "Ready to shop" : "Currently unavailable";
      statusChip.className = `quick-status-chip ${inStock ? "is-in-stock" : "is-out-of-stock"}`;
    }
    if (addBtn instanceof HTMLButtonElement) {
      addBtn.textContent = "Add to cart";
      addBtn.classList.remove("added");
      addBtn.disabled = !inStock;
    }
    if (buyBtn instanceof HTMLButtonElement) buyBtn.disabled = !inStock;
    if (qtyInput instanceof HTMLInputElement) {
      qtyInput.value = "1";
      qtyInput.min = "1";
      if (stockLimit > 0) qtyInput.max = String(stockLimit);
      else qtyInput.removeAttribute("max");
    }
    if (qtyMinus instanceof HTMLButtonElement) qtyMinus.disabled = !inStock;
    if (qtyPlus instanceof HTMLButtonElement) qtyPlus.disabled = !inStock || stockLimit <= 1;
    if (colorLabel) colorLabel.textContent = `Color: ${selectedColorInfo.label}`;

    if (sizeRow instanceof HTMLElement) {
      const sizeOptions = getProductSizeOptions(quickProduct);
      sizeRow.innerHTML = sizeOptions
        .map((size, index) => `
          <button
            type="button"
            class="quick-size${index === 0 ? " active" : ""}"
            aria-label="${escapeProductHtml(size)}"
            title="${escapeProductHtml(size)}"
          >${escapeProductHtml(size)}</button>
        `)
        .join("");
      sizeRow.classList.toggle("is-single", sizeOptions.length === 1);
    }

    if (thumbs) {
      thumbs.innerHTML = "";
      productImages.forEach((src, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `quick-thumb ${idx === 0 ? "active" : ""}`;
        btn.setAttribute("aria-label", `Select image ${idx + 1}`);
        btn.innerHTML = `<img src="${src}" alt="${quickProduct.name} image ${idx + 1}">`;
        btn.addEventListener("click", function () {
          activeImage = src;
          if (image instanceof HTMLImageElement) image.src = activeImage;
          thumbs.querySelectorAll(".quick-thumb").forEach((t) => t.classList.remove("active"));
          btn.classList.add("active");
        });
        thumbs.appendChild(btn);
      });
    }

    const swatchRow = modal.querySelector(".quick-swatch-row");
    if (swatchRow instanceof HTMLElement) {
      swatchRow.innerHTML = colorOptions
        .map((color, index) => `
          <button
            type="button"
            class="quick-swatch${index === 0 ? " active" : ""}"
            style="background:${escapeProductHtml(color.hex)};border-color:${escapeProductHtml(color.border)}"
            data-color-label="${escapeProductHtml(color.label)}"
            data-color-hex="${escapeProductHtml(color.hex)}"
            data-color-border="${escapeProductHtml(color.border)}"
            aria-label="${escapeProductHtml(color.label)}"
            title="${escapeProductHtml(color.label)}"
          ></button>
        `)
        .join("");
    }

    modal.removeAttribute("hidden");
    window.requestAnimationFrame(function () {
      modal.classList.add("is-active");
    });
    document.body.classList.add("quick-view-open");
  }

  function closeQuickView() {
    const modal = document.getElementById("quick-view-modal");
    if (!modal) return;
    modal.classList.remove("is-active");
    window.setTimeout(function () {
      if (modal.classList.contains("is-active")) return;
      modal.setAttribute("hidden", "");
    }, 280);
    document.body.classList.remove("quick-view-open");
    modalProduct = null;
  }

  document.addEventListener("click", async function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.closest("[data-role='close-modal']")) {
      event.preventDefault();
      event.stopPropagation();
      closeQuickView();
      return;
    }

    const quickBtn = target.closest(".product-quick-view");
    if (quickBtn) {
      const card = quickBtn.closest(CARD_SELECTOR);
      if (card) openQuickViewByCard(card);
      return;
    }

    const addBtn = target.closest("#quick-view-add");
    if (addBtn instanceof HTMLButtonElement) {
      if (!modalProduct) return;
      const qtyInput = document.getElementById("quick-view-qty");
      const stockLimit = getProductStockQuantity(modalProduct);
      const requestedQty = qtyInput instanceof HTMLInputElement ? Math.max(1, parseInt(qtyInput.value || "1", 10)) : 1;
      const qty = stockLimit > 0 ? Math.min(requestedQty, stockLimit) : requestedQty;
      if (qtyInput instanceof HTMLInputElement) qtyInput.value = String(qty);
      const selectedSizeEl = document.querySelector(".quick-size.active");
      const selectedSize = selectedSizeEl ? `Size: ${selectedSizeEl.textContent?.trim()}` : "Size: M";
      const colorLabel = document.getElementById("quick-view-color-label");
      const selectedColor = colorLabel ? String(colorLabel.textContent || "Color: Standard").trim() : "Color: Standard";
      const ok = await addProductToCart(modalProduct, qty, { color: selectedColor, size: selectedSize });
      if (!ok) return;
      addBtn.classList.add("is-adding");
      addBtn.classList.add("added");
      addBtn.textContent = "Added";
      window.setTimeout(function () {
        addBtn.classList.remove("is-adding");
        addBtn.classList.remove("added");
        addBtn.textContent = "Add to cart";
      }, 800);
      return;
    }

    const plusBtn = target.closest("#quick-qty-plus");
    if (plusBtn) {
      const qtyInput = document.getElementById("quick-view-qty");
      if (qtyInput instanceof HTMLInputElement) {
        const stockLimit = modalProduct ? getProductStockQuantity(modalProduct) : 0;
        const requestedQty = Math.max(1, parseInt(qtyInput.value || "1", 10)) + 1;
        const qty = stockLimit > 0 ? Math.min(requestedQty, stockLimit) : requestedQty;
        qtyInput.value = String(qty);
        if (stockLimit > 0 && requestedQty > stockLimit) {
          window.BenzyCartStore?.showToast?.(
            `Only ${stockLimit} ${stockLimit === 1 ? "piece is" : "pieces are"} left in stock. Please proceed with ${stockLimit} or choose another product.`,
            "error"
          );
        }
        if (plusBtn instanceof HTMLButtonElement) plusBtn.disabled = stockLimit > 0 && qty >= stockLimit;
      }
      return;
    }

    const minusBtn = target.closest("#quick-qty-minus");
    if (minusBtn) {
      const qtyInput = document.getElementById("quick-view-qty");
      if (qtyInput instanceof HTMLInputElement) {
        const qty = Math.max(1, parseInt(qtyInput.value || "1", 10) - 1);
        qtyInput.value = String(qty);
        const plusButton = document.getElementById("quick-qty-plus");
        if (plusButton instanceof HTMLButtonElement) plusButton.disabled = false;
      }
      return;
    }

    const sizeBtn = target.closest(".quick-size");
    if (sizeBtn) {
      const row = sizeBtn.closest(".quick-size-row");
      if (row) row.querySelectorAll(".quick-size").forEach((btn) => btn.classList.remove("active"));
      sizeBtn.classList.add("active");
      return;
    }

    const swatchBtn = target.closest(".quick-swatch");
    if (swatchBtn) {
      const row = swatchBtn.closest(".quick-swatch-row");
      if (row) row.querySelectorAll(".quick-swatch").forEach((btn) => btn.classList.remove("active"));
      swatchBtn.classList.add("active");
      const colorLabel = document.getElementById("quick-view-color-label");
      const copy = document.getElementById("quick-view-copy");
      const selectedColorInfo = {
        label: swatchBtn.getAttribute("data-color-label") || "Default",
        hex: swatchBtn.getAttribute("data-color-hex") || "#d0d0d0",
        border: swatchBtn.getAttribute("data-color-border") || "#9e9e9e"
      };
      if (colorLabel) colorLabel.textContent = `Color: ${selectedColorInfo.label}`;
      if (copy && modalProduct) copy.textContent = getQuickViewCopy(modalProduct, selectedColorInfo);
      return;
    }

    const buyBtn = target.closest("#quick-view-buy");
    if (buyBtn instanceof HTMLButtonElement) {
      if (!modalProduct) return;
      const qtyInput = document.getElementById("quick-view-qty");
      const stockLimit = getProductStockQuantity(modalProduct);
      const requestedQty = qtyInput instanceof HTMLInputElement ? Math.max(1, parseInt(qtyInput.value || "1", 10)) : 1;
      const qty = stockLimit > 0 ? Math.min(requestedQty, stockLimit) : requestedQty;
      if (qtyInput instanceof HTMLInputElement) qtyInput.value = String(qty);
      const selectedSizeEl = document.querySelector(".quick-size.active");
      const selectedSize = selectedSizeEl ? `Size: ${selectedSizeEl.textContent?.trim()}` : "Size: M";
      const colorLabel = document.getElementById("quick-view-color-label");
      const selectedColor = colorLabel ? String(colorLabel.textContent || "Color: Standard").trim() : "Color: Standard";
      const ok = await addProductToCart(modalProduct, qty, { color: selectedColor, size: selectedSize });
      if (!ok) return;
      window.location.href = "Cart.html";
      return;
    }

    const card = target.closest(CARD_SELECTOR);
    if (!card) return;
    if (target.closest("button, input, select, textarea, a")) return;
    const id = card.getAttribute("data-id");
    if (!id) return;
    window.location.href = `Product.html?id=${id}`;
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeQuickView();
  });

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id !== "quick-view-qty") return;
    const value = parseInt(target.value || "1", 10);
    target.value = String(Number.isNaN(value) || value < 1 ? 1 : value);
  });
})();

(function () {
  const cartItemsWrap = document.getElementById("cart-items");
  const emptyEl = document.getElementById("cart-empty");
  const subtotalEl = document.getElementById("cart-subtotal");
  const taxEl = document.getElementById("cart-tax");
  const totalEl = document.getElementById("cart-total");
  const checkoutBtn = document.getElementById("checkout-btn");
  const checkoutPaymentWrap = document.getElementById("checkout-payment-wrap");
  const checkoutPaymentSelect = document.getElementById("checkout-payment-select");
  const checkoutPaymentHint = document.getElementById("checkout-payment-hint");
  const currencySelect = document.getElementById("currency-select");
  const notesToggle = document.getElementById("notes-toggle");
  const notesWrap = document.getElementById("notes-wrap");
  const couponInput = document.getElementById("coupon-code");
  const applyCouponBtn = document.getElementById("apply-coupon");
  const couponMessageEl = document.getElementById("coupon-message");
  const CURRENCY_KEY = "benzy_currency";
  const RATE_MODE_KEY = "benzy_rate_mode";
  const CART_KEY = "benzy_cart_items";
  const COUPON_KEY = "benzy_discount_coupon";
  const TOKEN_KEY = "benzy_auth_token";
  const LOGIN_INTENT_KEY = "benzy_login_intent";
  const API_URL = "https://open.er-api.com/v6/latest/USD";
  const API_BASES = (() => {
    const bases = [];
    const origin = window.location.origin;
    const stored = readBenzyStoredApiBase();
    bases.push("https://benzy-luxury-website.onrender.com");
    if (stored && stored !== origin) bases.push(stored);
    return Array.from(new Set(bases));
  })();

  if (window.__BENZY_SKIP_CART_PAGE_BOOT || !cartItemsWrap || !subtotalEl || !taxEl || !totalEl) return;

  const manualRates = {
    USD: 1,
    NGN: 1376.86
  };

  const currencyConfig = {
    USD: { rate: manualRates.USD, locale: "en-US", currency: "USD" },
    NGN: { rate: manualRates.NGN, locale: "en-NG", currency: "NGN" }
  };

  const urlRateMode = new URLSearchParams(window.location.search).get("rates");
  let activeRateMode = localStorage.getItem(RATE_MODE_KEY) || "manual";
  if (urlRateMode === "api" || urlRateMode === "manual") {
    activeRateMode = urlRateMode;
    localStorage.setItem(RATE_MODE_KEY, activeRateMode);
  }

  let activeCurrency = localStorage.getItem(CURRENCY_KEY) || "NGN";
  if (!currencyConfig[activeCurrency]) activeCurrency = "NGN";
  if (currencySelect) currencySelect.value = activeCurrency;

  function formatMoney(usdAmount) {
    const cfg = currencyConfig[activeCurrency];
    return new Intl.NumberFormat(cfg.locale, {
      style: "currency",
      currency: cfg.currency,
      maximumFractionDigits: 2
    }).format(usdAmount * cfg.rate);
  }

  function ensureMinQty(input) {
    const val = parseInt(input.value, 10);
    input.value = Number.isNaN(val) || val < 1 ? 1 : val;
  }

  function saveCartItems(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("benzy:cart-updated"));
  }

  function normalizeUserEmail(email) {
    return String(email || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  }

  function getCurrentUserEmailFromToken() {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) return "";
    try {
      const payloadPart = token.split(".")[1] || "";
      if (!payloadPart) return "";
      const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const payload = JSON.parse(atob(padded));
      return String(payload?.email || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeCouponCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  function roundAmount(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return 0;
    return Number(amount.toFixed(2));
  }

  function readCouponState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(COUPON_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeCouponState(state) {
    if (!state || typeof state !== "object") {
      localStorage.removeItem(COUPON_KEY);
      return;
    }
    localStorage.setItem(COUPON_KEY, JSON.stringify(state));
  }

  function clearCouponState() {
    localStorage.removeItem(COUPON_KEY);
  }

  function setCouponMessage(text, state) {
    if (!(couponMessageEl instanceof HTMLElement)) return;
    couponMessageEl.textContent = text || "";
    if (state) {
      couponMessageEl.dataset.state = state;
    } else {
      delete couponMessageEl.dataset.state;
    }
  }

  function getValidatedCouponForEmail(email) {
    const state = readCouponState();
    const normalizedEmail = normalizeEmail(email);
    if (!state?.code || state.status !== "validated") return null;
    if (normalizeEmail(state.email) !== normalizedEmail) return null;
    return state;
  }

  function getCouponDiscount(subtotalUsd, email) {
    const activeCoupon = getValidatedCouponForEmail(email);
    if (!activeCoupon) return 0;
    return roundAmount(Number(subtotalUsd || 0) * 0.1);
  }

  async function validateCouponWithApi(email, couponCode) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = normalizeCouponCode(couponCode);

    for (const base of API_BASES) {
      try {
        const response = await fetch(`${base}/api/coupons/validate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            email: normalizedEmail,
            couponCode: normalizedCode
          })
        });
        const data = await response.json().catch(() => ({}));
        if (shouldReturnApiResponse(response, data)) {
          return { response, data };
        }
      } catch {
        // Try the next available API base.
      }
    }

    throw new Error("Unable to reach coupon validation service.");
  }

  async function ensureCouponReadyForEmail(email) {
    const state = readCouponState();
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = normalizeCouponCode(state?.code);

    if (!normalizedCode) return null;
    if (!normalizedEmail) return null;

    const existingCoupon = getValidatedCouponForEmail(normalizedEmail);
    if (existingCoupon) return existingCoupon;

    const { response, data } = await validateCouponWithApi(normalizedEmail, normalizedCode);
    if (!response.ok || !data?.valid) {
      clearCouponState();
      throw new Error(String(data?.message || "Coupon validation failed."));
    }

    const nextState = {
      code: normalizedCode,
      email: normalizedEmail,
      status: "validated",
      source: String(data?.source || "footer"),
      discountPercent: Number(data?.discountPercent || 10),
      validatedAt: new Date().toISOString()
    };
    writeCouponState(nextState);
    return nextState;
  }

  function userOrdersKey(email) {
    return `benzy_account_${normalizeUserEmail(email)}_orders`;
  }

  function userPaymentsKey(email) {
    return `benzy_account_${normalizeUserEmail(email)}_payments`;
  }

  function userWalletKey(email) {
    return `benzy_account_${normalizeUserEmail(email)}_wallet`;
  }

  function loadUserOrders(email) {
    const key = userOrdersKey(email);
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveUserOrders(email, orders) {
    const key = userOrdersKey(email);
    localStorage.setItem(key, JSON.stringify(orders));
  }

  function loadUserPayments(email) {
    const key = userPaymentsKey(email);
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function loadUserWallet(email) {
    const key = userWalletKey(email);
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{"balance":0,"tx":[]}');
      const balance = Number(parsed?.balance || 0);
      const tx = Array.isArray(parsed?.tx) ? parsed.tx : [];
      return { balance, tx };
    } catch {
      return { balance: 0, tx: [] };
    }
  }

  function saveUserWallet(email, wallet) {
    const key = userWalletKey(email);
    localStorage.setItem(key, JSON.stringify(wallet));
  }

  function getDisplayPaymentLabel(item) {
    const type = String(item?.type || "Method");
    const holder = String(item?.holder || "Holder");
    const last4 = String(item?.last4 || "").padStart(4, "*").slice(-4);
    const isDefault = Boolean(item?.isDefault);
    return `${type} â€¢ ${holder} â€¢ **** ${last4}${isDefault ? " (Default)" : ""}`;
  }

  function getSelectedPaymentMethod(email) {
    const payments = loadUserPayments(email);
    if (!payments.length) return null;

    if (checkoutPaymentSelect instanceof HTMLSelectElement) {
      const idx = parseInt(String(checkoutPaymentSelect.value || ""), 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < payments.length) {
        return { item: payments[idx], index: idx };
      }
    }

    const defaultIndex = payments.findIndex((item) => Boolean(item?.isDefault));
    const safeIndex = defaultIndex >= 0 ? defaultIndex : 0;
    return { item: payments[safeIndex], index: safeIndex };
  }

  function renderCheckoutPaymentMethods() {
    if (
      !(checkoutPaymentWrap instanceof HTMLElement) ||
      !(checkoutPaymentSelect instanceof HTMLSelectElement) ||
      !(checkoutPaymentHint instanceof HTMLElement)
    ) {
      return;
    }

    checkoutPaymentWrap.hidden = false;
    checkoutPaymentSelect.innerHTML = '<option value="">Select payment method</option>';

    const email = getCurrentUserEmailFromToken();
    if (!email) {
      checkoutPaymentSelect.disabled = true;
      checkoutPaymentHint.textContent = "Login to use your saved payment methods.";
      return;
    }

    const payments = loadUserPayments(email);
    if (!payments.length) {
      checkoutPaymentSelect.disabled = true;
      checkoutPaymentHint.textContent = "No saved payment method.";
      return;
    }

    checkoutPaymentSelect.disabled = false;
    const defaultIndex = payments.findIndex((item) => Boolean(item?.isDefault));
    const safeIndex = defaultIndex >= 0 ? defaultIndex : 0;

    payments.forEach((item, idx) => {
      const option = document.createElement("option");
      option.value = String(idx);
      option.textContent = getDisplayPaymentLabel(item);
      if (idx === safeIndex) option.selected = true;
      checkoutPaymentSelect.appendChild(option);
    });

    checkoutPaymentHint.textContent = "Your default method is preselected.";
  }

  function getCartTotalsFromItems(items, customerEmail = "") {
    const safeItems = Array.isArray(items) ? items : [];
    const subtotalUsd = safeItems.reduce(function (sum, item) {
      const qty = Math.max(1, parseInt(String(item?.qty || 1), 10));
      const price = Number(item?.priceUsd || 0);
      return sum + qty * price;
    }, 0);
    const discountUsd = getCouponDiscount(subtotalUsd, customerEmail);
    const discountedSubtotalUsd = roundAmount(Math.max(0, subtotalUsd - discountUsd));
    const taxUsd = roundAmount(discountedSubtotalUsd * 0.075);
    const totalUsd = roundAmount(discountedSubtotalUsd + taxUsd);
    return { subtotalUsd, discountUsd, discountedSubtotalUsd, taxUsd, totalUsd };
  }

  function makeOrderId() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const rand = Math.floor(Math.random() * 90000) + 10000;
    return `BLX-${stamp}-${rand}`;
  }

  function createOrderRecord(items, customerEmail, paymentSummary) {
    const safeItems = Array.isArray(items) ? items : [];
    const totals = getCartTotalsFromItems(safeItems, customerEmail);
    const activeCoupon = getValidatedCouponForEmail(customerEmail);
    const totalQty = safeItems.reduce(function (sum, item) {
      const qty = Math.max(1, parseInt(String(item?.qty || 1), 10));
      return sum + qty;
    }, 0);
    const firstTitle = String(safeItems[0]?.title || "Order");
    const title = safeItems.length > 1 ? `${firstTitle} + ${safeItems.length - 1} more` : firstTitle;
    return {
      id: makeOrderId(),
      title,
      qty: totalQty,
      total: totals.totalUsd,
      subtotal: totals.subtotalUsd,
      discountedSubtotal: totals.discountedSubtotalUsd,
      discountAmount: totals.discountUsd,
      discountPercent: activeCoupon ? Number(activeCoupon.discountPercent || 10) : 0,
      discountCode: activeCoupon?.code || "",
      tax: totals.taxUsd,
      shipping: 0,
      status: "Placed",
      date: new Date().toISOString().slice(0, 10),
      customerEmail: String(customerEmail || "").trim().toLowerCase(),
      paymentMethod: String(paymentSummary || "Not selected"),
      items: safeItems
    };
  }

  function normalizeUserEmail(email) {
    return String(email || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  }

  function getStoredShippingAddress(email) {
    if (!email) return "Delivery details pending";
    const legacyKey = `benzy_account_${normalizeUserEmail(email)}_profile`;
    try {
      const data = JSON.parse(localStorage.getItem(legacyKey) || "{}");
      const line = String(data?.address || "").trim();
      const city = String(data?.city || "").trim();
      const country = String(data?.country || "").trim();
      const fromLine = [line, city, country].filter(Boolean).join(", ");
      if (fromLine) return fromLine;
      const addresses = Array.isArray(data?.addresses) ? data.addresses : [];
      if (addresses.length) {
        const first = addresses[0];
        const line1 = String(first?.line || "").trim();
        const city1 = String(first?.city || "").trim();
        const country1 = String(first?.country || "").trim();
        const derived = [line1, city1, country1].filter(Boolean).join(", ");
        if (derived) return derived;
      }
    } catch {
      // ignore storage errors
    }
    return "Delivery details pending";
  }

  async function postOrderToApi(order, email, paymentSummary) {
    const payload = {
      orderId: order.id,
      customerEmail: email,
      status: "placed",
      orderDate: order.date,
      items: (Array.isArray(order.items) ? order.items : []).map((item) => ({
        name: String(item?.title || item?.name || "Item"),
        quantity: Math.max(1, parseInt(String(item?.qty || item?.quantity || 1), 10)),
        price: Number(item?.priceUsd ?? item?.price ?? 0)
      })),
      subtotal: order.subtotal,
      discountedSubtotal: order.discountedSubtotal,
      discountAmount: order.discountAmount,
      discountPercent: order.discountPercent,
      discountCode: order.discountCode,
      couponCode: order.discountCode,
      tax: order.tax,
      shipping: order.shipping,
      total: order.total,
      paymentMethod: String(paymentSummary || "Not selected"),
      shippingAddress: getStoredShippingAddress(email),
      currency: "USD"
    };

    for (const base of API_BASES) {
      try {
        const response = await fetch(`${base}/api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders()
          },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          return { ok: true, data };
        }
        if (shouldReturnApiResponse(response, data)) {
          return { ok: false, status: response.status, data };
        }
      } catch {
        // try next base
      }
    }
    return { ok: false, status: 0, data: null };
  }

  function loadCartItems() {
    const raw = localStorage.getItem(CART_KEY);
    if (raw === null) return null;

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function serializeDomItems() {
    const nodes = cartItemsWrap.querySelectorAll(".cart-ref-item, .cart-item");

    return Array.from(nodes).map((node) => {
      const title = node.querySelector("h3")?.textContent?.trim() || "Product";
      const metaLines = node.querySelectorAll(".product-meta p");
      const color = metaLines[0]?.textContent?.trim() || "";
      const size = metaLines[1]?.textContent?.trim() || "";
      const colorLabel = normalizeCartOptionLabel(color, "Color", "Standard");
      const sizeLabel = normalizeCartOptionLabel(size, "Size", "M");
      const image = node.querySelector("img")?.getAttribute("src") || "";
      const alt = node.querySelector("img")?.getAttribute("alt") || title;
      const qty = Math.max(1, parseInt(node.querySelector(".qty-input")?.value || "1", 10));
      const rawPriceNgn = parseFloat(node.dataset.priceNgn || node.dataset.price || "0");
      const priceUsd = parseFloat(node.dataset.priceUsd || "0");
      const productId = String(node.getAttribute("data-product-id") || "").trim();
      const variantId = String(node.getAttribute("data-variant-id") || "").trim();
      const categoryId = String(node.getAttribute("data-category-id") || "").trim();
      const priceNgn = Number.isFinite(rawPriceNgn) && rawPriceNgn > 0
        ? rawPriceNgn
        : convertAmountToNgn(priceUsd, "USD");

      return {
        id: productId,
        productId,
        variantId,
        category: categoryId || "all",
        categoryId: categoryId || "all",
        name: title,
        title,
        color: formatCartOptionLabel(colorLabel, "Color", "Standard"),
        colorLabel,
        size: formatCartOptionLabel(sizeLabel, "Size", "M"),
        sizeLabel,
        image,
        alt,
        qty,
        quantity: qty,
        price: priceNgn,
        priceNgn
      };
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getCartOptionDisplay(item, labelKey, displayKey, prefix, fallback) {
    return formatCartOptionLabel(item?.[labelKey] || item?.[displayKey], prefix, fallback);
  }

  function createCartItemElement(item) {
    const article = document.createElement("article");
    article.className = "cart-ref-item row";
    article.dataset.priceNgn = String(item.priceNgn ?? item.price ?? 0);
    article.setAttribute("data-product-id", String(item.productId || item.id || ""));
    article.setAttribute("data-variant-id", String(item.variantId || ""));
    article.setAttribute("data-category-id", String(item.categoryId || item.category || "all"));

    const safeTitle = escapeHtml(item.title || "Product");
    const safeColor = escapeHtml(getCartOptionDisplay(item, "colorLabel", "color", "Color", "Standard"));
    const safeSize = escapeHtml(getCartOptionDisplay(item, "sizeLabel", "size", "Size", "M"));
    const safeImage = escapeHtml(item.image || "");
    const safeAlt = escapeHtml(item.alt || item.title || "Product");
    const safeQty = Math.max(1, parseInt(item.qty || 1, 10));

    article.innerHTML = `
      <div class="product-col">
        <img src="${safeImage}" alt="${safeAlt}">
        <div class="product-meta">
          <h3>${safeTitle}</h3>
          <p>${safeColor}</p>
          <p>${safeSize}</p>
        </div>
      </div>

      <div class="price-col">
        <strong data-role="item-price">$0.00</strong>
      </div>

      <div class="qty-col">
        <div class="qty-box">
          <button class="qty-btn qty-minus" type="button">-</button>
          <input class="qty-input" type="number" min="1" value="${safeQty}" />
          <button class="qty-btn qty-plus" type="button">+</button>
        </div>
        <button class="remove-link cart-remove" type="button" aria-label="Remove item">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"></path>
          </svg>
        </button>
      </div>

      <div class="total-col">
        <strong data-role="item-total">$0.00</strong>
      </div>
    `;

    return article;
  }

  function renderCartItems(items) {
    cartItemsWrap.innerHTML = "";
    items.forEach((item) => {
      cartItemsWrap.appendChild(createCartItemElement(item));
    });
    if (emptyEl) {
      const isEmpty = items.length === 0;
      emptyEl.hidden = !isEmpty;
      emptyEl.style.display = isEmpty ? "" : "none";
    }
  }

  function persistCartFromDom() {
    saveCartItems(serializeDomItems());
  }

  function hydrateCartFromStorage() {
    const stored = loadCartItems();

    if (stored === null) {
      persistCartFromDom();
      return;
    }

    renderCartItems(stored);
  }

  function computeTotals() {
    const items = cartItemsWrap.querySelectorAll(".cart-ref-item, .cart-item");
    const currentEmail = getCurrentUserEmailFromToken();

    if (!items.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.style.display = "";
      }
      subtotalEl.textContent = formatMoney(0);
      taxEl.textContent = formatMoney(0);
      totalEl.textContent = formatMoney(0);
      return;
    }

    if (emptyEl) {
      emptyEl.hidden = true;
      emptyEl.style.display = "none";
    }

    let subtotalNgn = 0;
    items.forEach((item) => {
      const priceNgn = parseFloat(item.dataset.priceNgn || item.dataset.price || "0");
      const qtyInput = item.querySelector(".qty-input");
      if (!(qtyInput instanceof HTMLInputElement)) return;

      ensureMinQty(qtyInput);
      const qty = parseInt(qtyInput.value, 10);
      const lineNgn = priceNgn * qty;
      subtotalNgn += lineNgn;

      const priceEl = item.querySelector('[data-role="item-price"]');
      if (priceEl) priceEl.textContent = formatMoney(priceNgn);

      const lineEl = item.querySelector('[data-role="item-total"]');
      if (lineEl) lineEl.textContent = formatMoney(lineNgn);
    });

    const discountNgn = getCouponDiscount(subtotalNgn, currentEmail);
    const discountedSubtotalNgn = roundAmount(Math.max(0, subtotalNgn - discountNgn));
    const taxNgn = roundAmount(discountedSubtotalNgn * 0.075);
    const totalNgn = roundAmount(discountedSubtotalNgn + taxNgn);

    subtotalEl.textContent = formatMoney(subtotalNgn);
    taxEl.textContent = formatMoney(taxNgn);
    totalEl.textContent = formatMoney(totalNgn);
  }

  function applyManualRates() {
    currencyConfig.USD.rate = manualRates.USD;
    currencyConfig.NGN.rate = manualRates.NGN;
  }

  function applyApiRates(rates) {
    if (!rates || typeof rates !== "object") return false;

    const needed = ["USD", "NGN"];
    const hasAll = needed.every((code) => typeof rates[code] === "number");
    if (!hasAll) return false;

    currencyConfig.USD.rate = rates.USD;
    currencyConfig.NGN.rate = rates.NGN;
    return true;
  }

  async function initRates() {
    if (activeRateMode !== "api") {
      applyManualRates();
      computeTotals();
      return;
    }

    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Rate API request failed.");
      const data = await response.json();
      const ok = applyApiRates(data.rates);
      if (!ok) throw new Error("Rate API payload missing required currencies.");
    } catch {
      activeRateMode = "manual";
      localStorage.setItem(RATE_MODE_KEY, activeRateMode);
      applyManualRates();
    }

    computeTotals();
  }

  cartItemsWrap.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const item = target.closest(".cart-ref-item, .cart-item");
    if (!item) return;

    const qtyInput = item.querySelector(".qty-input");
    if (!(qtyInput instanceof HTMLInputElement)) return;

    if (target.classList.contains("qty-plus")) {
      qtyInput.value = String(parseInt(qtyInput.value || "1", 10) + 1);
      persistCartFromDom();
      computeTotals();
      return;
    }

    if (target.classList.contains("qty-minus")) {
      qtyInput.value = String(Math.max(1, parseInt(qtyInput.value || "1", 10) - 1));
      persistCartFromDom();
      computeTotals();
      return;
    }

    if (target.closest(".cart-remove")) {
      item.remove();
      persistCartFromDom();
      computeTotals();
    }
  });

  cartItemsWrap.addEventListener("input", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains("qty-input")) return;
    ensureMinQty(target);
    persistCartFromDom();
    computeTotals();
  });

  if (currencySelect) {
    currencySelect.addEventListener("change", function () {
      activeCurrency = currencySelect.value;
      localStorage.setItem(CURRENCY_KEY, activeCurrency);
      computeTotals();
    });
  }

  if (notesToggle && notesWrap) {
    notesToggle.addEventListener("click", function () {
      const hidden = notesWrap.hasAttribute("hidden");
      if (hidden) {
        notesWrap.removeAttribute("hidden");
        notesToggle.textContent = "Add notes -";
      } else {
        notesWrap.setAttribute("hidden", "");
        notesToggle.textContent = "Add notes +";
      }
    });
  }

  async function syncCouponUi() {
    const state = readCouponState();
    const email = getCurrentUserEmailFromToken();

    if (couponInput instanceof HTMLInputElement && state?.code && !couponInput.value.trim()) {
      couponInput.value = String(state.code);
    }

    if (!state?.code) {
      setCouponMessage("", "");
      computeTotals();
      return;
    }

    if (!email) {
      setCouponMessage("Code saved. Log in to apply your 10% first-order discount.", "info");
      computeTotals();
      return;
    }

    try {
      const coupon = await ensureCouponReadyForEmail(email);
      if (coupon) {
        setCouponMessage(
          `Coupon applied. ${Number(coupon.discountPercent || 10)}% off will be used on your first order.`,
          "success"
        );
      } else {
        setCouponMessage("", "");
      }
    } catch (error) {
      setCouponMessage(String(error?.message || "Unable to apply coupon."), "error");
    }

    computeTotals();
  }

  if (applyCouponBtn instanceof HTMLButtonElement && couponInput instanceof HTMLInputElement) {
    applyCouponBtn.addEventListener("click", async function () {
      const code = normalizeCouponCode(couponInput.value);
      if (!code) {
        clearCouponState();
        setCouponMessage("Enter your coupon code.", "error");
        computeTotals();
        return;
      }

      couponInput.value = code;
      const email = getCurrentUserEmailFromToken();
      if (!email) {
        writeCouponState({
          code,
          status: "saved",
          email: "",
          source: "footer",
          discountPercent: 10,
          savedAt: new Date().toISOString()
        });
        setCouponMessage("Code saved. Log in to apply your 10% first-order discount.", "info");
        computeTotals();
        return;
      }

      applyCouponBtn.disabled = true;
      setCouponMessage("Checking coupon...", "pending");

      try {
        const { response, data } = await validateCouponWithApi(email, code);
        if (response.ok && data?.valid) {
          writeCouponState({
            code,
            email: normalizeEmail(email),
            status: "validated",
            source: String(data?.source || "footer"),
            discountPercent: Number(data?.discountPercent || 10),
            validatedAt: new Date().toISOString()
          });
          setCouponMessage(
            `Coupon applied. ${Number(data?.discountPercent || 10)}% off will be used on your first order.`,
            "success"
          );
        } else {
          clearCouponState();
          setCouponMessage(String(data?.message || "Unable to apply coupon."), "error");
        }
      } catch {
        writeCouponState({
          code,
          status: "saved",
          email: "",
          source: "footer",
          discountPercent: 10,
          savedAt: new Date().toISOString()
        });
        setCouponMessage("We saved your code, but couldn't verify it right now. Log in and try again at checkout.", "info");
      } finally {
        applyCouponBtn.disabled = false;
        computeTotals();
      }
    });
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", function () {
      const items = serializeDomItems();
      if (!items.length) {
        alert("Your cart is empty.");
        return;
      }

      const email = getCurrentUserEmailFromToken();
      if (!email) {
        localStorage.setItem(LOGIN_INTENT_KEY, "resident");
        alert("Please login as resident to place your order.");
        window.location.href = "Profile.html";
        return;
      }

      const selectedPayment = getSelectedPaymentMethod(email);
      const paymentItem = selectedPayment?.item || null;
      const paymentType = String(paymentItem?.type || "").trim();
      const paymentHolder = String(paymentItem?.holder || "").trim();
      const paymentLast4 = String(paymentItem?.last4 || "").replace(/\D/g, "").slice(-4);
      const paymentSummary = paymentItem
        ? `${paymentType || "Method"} • ${paymentHolder || "Holder"} • **** ${paymentLast4 || "0000"}`
        : "Not selected";

      checkoutBtn.classList.add("is-processing");
      window.setTimeout(async function () {
        try {
          await ensureCouponReadyForEmail(email).catch((error) => {
            const state = readCouponState();
            if (!state?.code) return null;
            throw error;
          });

          const order = createOrderRecord(items, email, paymentSummary);

          if (/^wallet$/i.test(paymentType)) {
            const wallet = loadUserWallet(email);
            if (wallet.balance + 0.0001 < order.total) {
              checkoutBtn.classList.remove("is-processing");
              alert(`Insufficient wallet balance. Available: ${formatMoney(wallet.balance)}`);
              return;
            }

            wallet.balance = Math.max(0, Number((wallet.balance - order.total).toFixed(2)));
            wallet.tx = Array.isArray(wallet.tx) ? wallet.tx : [];
            wallet.tx.push({
              type: `Order Payment (${order.id})`,
              amount: -order.total,
              date: new Date().toISOString().slice(0, 10)
            });
            saveUserWallet(email, wallet);
          }

          const apiResult = await postOrderToApi(order, email, paymentSummary);
          if (!apiResult.ok) {
            throw new Error(String(apiResult.data?.message || "Unable to place your order right now."));
          }

          const existingOrders = loadUserOrders(email);
          existingOrders.push(order);
          saveUserOrders(email, existingOrders);
          clearCouponState();
          setCouponMessage("", "");
          saveCartItems([]);
          cartItemsWrap.innerHTML = "";
          computeTotals();
          renderCheckoutPaymentMethods();
          checkoutBtn.classList.remove("is-processing");
          alert(`Order placed successfully. Order ID: ${order.id}`);
          window.location.href = "Account.html";
        } catch (error) {
          console.error("Checkout error:", error);
          checkoutBtn.classList.remove("is-processing");
          alert("Unable to place order. Please try again.");
        }
      }, 420);
    });
  }

  hydrateCartFromStorage();
  renderCheckoutPaymentMethods();
  window.addEventListener("storage", function (event) {
    if (event.key && /_payments$/.test(event.key)) renderCheckoutPaymentMethods();
    if (event.key === COUPON_KEY) void syncCouponUi();
  });
  void syncCouponUi();
  initRates();
})();

(function () {
  const CART_KEY = "benzy_cart_items";

  function getCartCount() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (!Array.isArray(parsed)) return 0;
      return parsed.reduce((sum, item) => {
        const qty = parseInt(item?.qty ?? 1, 10);
        return sum + (Number.isNaN(qty) || qty < 1 ? 1 : qty);
      }, 0);
    } catch {
      return 0;
    }
  }

  function renderCartBadge() {
    const count = getCartCount();
    const links = document.querySelectorAll(".cart-link");
    links.forEach((link) => {
      let badge = link.querySelector(".cart-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "cart-badge";
        badge.setAttribute("aria-live", "polite");
        link.appendChild(badge);
      }

      if (count > 0) {
        badge.hidden = false;
        badge.textContent = count > 99 ? "99+" : String(count);
      } else {
        badge.hidden = true;
        badge.textContent = "";
      }
    });
  }

  renderCartBadge();
  window.addEventListener("benzy:cart-updated", renderCartBadge);
  window.addEventListener("storage", function (event) {
    if (event.key === CART_KEY) renderCartBadge();
  });
})();

(function () {
  const RECENT_KEY = "benzy_recently_viewed";
  const RECENT_LIMIT = 20;
  const RECENT_DISPLAY_LIMIT = 5;

  function loadRecent() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveRecent(items) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items));
  }

  function pushRecent(item) {
    if (!item || !item.name || !item.image) return;
    const existing = loadRecent().filter((x) => x.name !== item.name);
    const next = [item, ...existing].slice(0, RECENT_LIMIT);
    saveRecent(next);
  }

  function captureCardClick(card) {
    const title =
      card.querySelector("[data-product-name]")?.textContent?.trim() ||
      card.querySelector("h3")?.textContent?.trim() ||
      card.querySelector("h4")?.textContent?.trim() ||
      card.getAttribute("data-name") ||
      "Product";

    const categoryRaw =
      card.getAttribute("data-category") ||
      card.querySelector("[data-product-category]")?.textContent?.trim() ||
      card.querySelector("p")?.textContent?.trim() ||
      "all";

    const category = String(categoryRaw).toLowerCase();
    const img = card.querySelector("img");
    const image = img?.getAttribute("src") || "";
    if (!image) return;

    pushRecent({ name: title, category: category, image: image });
  }

  function bindTrackers() {
    const selector = [
      ".shop-card",
      ".search-card",
      ".cart-ref-item",
      ".cart-item",
      ".recommend-grid article",
      "[data-product-card]"
    ].join(", ");

    const cards = document.querySelectorAll(selector);

    cards.forEach((card) => {
      if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "0");

      card.addEventListener("click", function (event) {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest(".qty-box, .qty-btn, .qty-input, .cart-remove, .remove-link, button, input, textarea, select")) {
          return;
        }
        captureCardClick(card);
      });

      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter") captureCardClick(card);
      });
    });
  }

  function renderRecentOnCart() {
    const grid = document.getElementById("recently-grid");
    const empty = document.getElementById("recently-empty");
    const desc = document.getElementById("recently-desc");
    if (!grid) return;

    const items = loadRecent();
    grid.innerHTML = "";

    if (!items.length) {
      if (empty) empty.hidden = false;
      if (desc) desc.textContent = "Describe your recently viewed products here";
      return;
    }

    if (empty) empty.hidden = true;
    if (desc) desc.textContent = "Based on products customers opened recently.";

    const visibleItems = items.slice(0, RECENT_DISPLAY_LIMIT);

    visibleItems.forEach((item) => {
      const article = document.createElement("article");
      const link = document.createElement("a");
      const img = document.createElement("img");
      const title = document.createElement("h4");

      const cat = String(item.category || "all").toLowerCase();
      const targetCat = ["men", "women", "accessories"].includes(cat) ? cat : "all";
      link.href = `Shop.html?cat=${targetCat}`;
      link.className = "recently-link";

      img.src = item.image;
      img.alt = item.name;
      title.textContent = item.name;

      link.appendChild(img);
      link.appendChild(title);
      article.appendChild(link);
      grid.appendChild(article);
    });

    const remaining = items.length - visibleItems.length;
    if (remaining > 0) {
      const moreCard = document.createElement("article");
      moreCard.className = "recently-more";
      moreCard.innerHTML = `<a class="recently-link" href="Recently.html"><span>+${remaining}</span><small>more</small></a>`;
      grid.appendChild(moreCard);
    }
  }

  bindTrackers();
  renderRecentOnCart();
})();

(function () {
  const RECENT_KEY = "benzy_recently_viewed";
  const grid = document.getElementById("recently-all-grid");
  const empty = document.getElementById("recently-all-empty");

  if (!grid) return;

  function loadRecent() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const items = loadRecent();
  grid.innerHTML = "";

  if (!items.length) {
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  items.forEach((item) => {
    const article = document.createElement("article");
    const link = document.createElement("a");
    const img = document.createElement("img");
    const title = document.createElement("h4");

    const cat = String(item.category || "all").toLowerCase();
    const targetCat = ["men", "women", "accessories"].includes(cat) ? cat : "all";

    link.href = `Shop.html?cat=${targetCat}`;
    link.className = "recently-link";

    img.src = item.image;
    img.alt = item.name;
    title.textContent = item.name;

    link.appendChild(img);
    link.appendChild(title);
    article.appendChild(link);
    grid.appendChild(article);
  });
})();






(function () {
  const grid = document.getElementById("lookbook-grid");
  if (!(grid instanceof HTMLElement)) return;

  const LOOKBOOK_IMAGES = [
    "Look Book/IMG_9998.jpg",
    "Look Book/IMG_9987.jpg",
    "Look Book/IMG_9983.jpg",
    "Look Book/IMG_9978.jpg",
    "Look Book/IMG_9973.jpg",
    "Look Book/IMG_9970.jpg",
    "Look Book/IMG_9967.jpg",
    "Look Book/IMG_9965.jpg",
    "Look Book/IMG_9964.jpg",
    "Look Book/IMG_9963.jpg",
    "Look Book/IMG_9957.jpg",
    "Look Book/IMG_9953.jpg",
    "Look Book/IMG_9949.jpg",
    "Look Book/IMG_9947.jpg",
    "Look Book/IMG_9945.jpg",
    "Look Book/IMG_9936.jpg",
    "Look Book/IMG_9935.jpg",
    "Look Book/IMG_9932.jpg",
    "Look Book/IMG_9931.jpg",
    "Look Book/IMG_9930.jpg",
    "Look Book/IMG_9928.jpg",
    "Look Book/IMG_9927.jpg",
    "Look Book/IMG_9926.jpg",
    "Look Book/IMG_9925.jpg",
    "Look Book/IMG_9920.jpg",
    "Look Book/IMG_9911.jpg",
    "Look Book/IMG_9904.jpg",
    "Look Book/IMG_9902.jpg",
    "Look Book/IMG_9867.jpg",
    "Look Book/IMG_9800.jpg",
    "Look Book/IMG_9783.jpg",
    "Look Book/IMG_9781.jpg",
    "Look Book/IMG_9774.jpg",
    "Look Book/IMG_9760.jpg",
    "Look Book/IMG_9759.jpg",
    "Look Book/IMG_9734.jpg",
    "Look Book/IMG_9722.jpg",
    "Look Book/IMG_9709.jpg",
    "Look Book/IMG_9701.jpg",
    "Look Book/IMG_9700.jpg",
    "Look Book/IMG_9698.jpg",
    "Look Book/IMG_9692.jpg",
    "Look Book/IMG_9686.jpg",
    "Look Book/IMG_9682.jpg",
    "Look Book/IMG_9677.jpg",
    "Look Book/IMG_9675.jpg",
    "Look Book/IMG_9653.jpg",
    "Look Book/IMG_9640.jpg",
    "Look Book/IMG_9636.jpg",
    "Look Book/IMG_9630.jpg",
    "Look Book/IMG_9629.jpg",
    "Look Book/IMG_9622.jpg",
    "Look Book/IMG_0118.jpg",
    "Look Book/IMG_0117.jpg",
    "Look Book/IMG_0107.jpg",
    "Look Book/IMG_0103.jpg",
    "Look Book/IMG_0102.jpg",
    "Look Book/IMG_0101.jpg",
    "Look Book/IMG_0100.jpg",
    "Look Book/IMG_0097.jpg",
    "Look Book/IMG_0093.jpg",
    "Look Book/IMG_0092.jpg",
    "Look Book/IMG_0090.jpg",
    "Look Book/IMG_0089.jpg",
    "Look Book/IMG_0086.jpg",
    "Look Book/IMG_0085.jpg",
    "Look Book/IMG_0083.jpg",
    "Look Book/IMG_0074.jpg",
    "Look Book/IMG_0073.jpg",
    "Look Book/IMG_0068.jpg",
    "Look Book/IMG_0067.jpg",
    "Look Book/IMG_0066.jpg",
    "Look Book/IMG_0064.jpg",
    "Look Book/IMG_0060.jpg",
    "Look Book/IMG_0059.jpg",
    "Look Book/IMG_0058.jpg",
    "Look Book/IMG_0057.jpg",
    "Look Book/IMG_0054.jpg",
    "Look Book/IMG_0053.jpg",
    "Look Book/IMG_0052.jpg",
    "Look Book/IMG_0049.jpg",
    "Look Book/IMG_0046.jpg",
    "Look Book/IMG_0031.jpg",
    "Look Book/IMG_0030.jpg",
    "Look Book/IMG_0026.jpg",
    "Look Book/IMG_0018.jpg",
    "Look Book/IMG_0010.jpg",
    "Look Book/IMG_0008.jpg",
    "Look Book/IMG_0006.jpg",
    "Look Book/IMG_0002.jpg"
  ];

  function shuffle(items) {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
    }
    return next;
  }

  const shuffledImages = shuffle(LOOKBOOK_IMAGES);
  grid.innerHTML = shuffledImages
    .map(
      (src, index) => `
        <button class="lookbook-card" type="button" data-src="${src}" aria-label="Open lookbook image ${index + 1}">
          <img src="${src}" alt="Benzy Luxury Look ${index + 1}" loading="lazy" />
        </button>
      `
    )
    .join("");

  const modal = document.createElement("div");
  modal.className = "lookbook-lightbox";
  modal.setAttribute("hidden", "");
  modal.innerHTML = `
    <button type="button" class="lookbook-lightbox-close" aria-label="Close lookbook image">x</button>
    <img src="" alt="Lookbook preview" />
  `;
  document.body.appendChild(modal);

  const modalImage = modal.querySelector("img");

  function closeModal() {
    modal.setAttribute("hidden", "");
    document.body.style.overflow = "";
  }

  function openModal(src, altText) {
    if (!(modalImage instanceof HTMLImageElement)) return;
    modalImage.src = src;
    modalImage.alt = altText || "Lookbook preview";
    modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
  }

  grid.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const card = target.closest(".lookbook-card");
    if (!(card instanceof HTMLButtonElement)) return;
    const src = card.getAttribute("data-src");
    const image = card.querySelector("img");
    if (!src) return;
    openModal(src, image?.getAttribute("alt") || "Lookbook preview");
  });

  modal.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.classList.contains("lookbook-lightbox")) {
      closeModal();
      return;
    }
    if (target.closest(".lookbook-lightbox-close")) closeModal();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
  });
})();

(function () {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  if (!isLocal) return;
  if (localStorage.getItem("benzy_hide_api_banner") === "1") return;

  const apiBase = readBenzyStoredApiBase() || "https://benzy-luxury-website.onrender.com";
  if (!document.body) return;

  const banner = document.createElement("div");
  banner.className = "api-base-banner";
  banner.innerHTML = `
    <span>API</span>
    <span>${apiBase}</span>
    <button type="button" aria-label="Hide API banner">&times;</button>
  `;
  const closeBtn = banner.querySelector("button");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      localStorage.setItem("benzy_hide_api_banner", "1");
      banner.remove();
    });
  }
  document.body.appendChild(banner);
})();


(function () {
  const CART_KEY = "benzy_cart_items";
  const COUPON_KEY = "benzy_discount_coupon";
  const TOKEN_KEY = "benzy_auth_token";
  const GUEST_ID_KEY = "benzy_guest_cart_id";
  const API_BASES = (() => {
    const bases = [];
    const origin = window.location.origin;
    const stored = readBenzyStoredApiBase();
    bases.push("https://benzy-luxury-website.onrender.com");
    if (stored && stored !== origin) bases.push(stored);
    return Array.from(new Set(bases));
  })();
  let suppressSync = false;
  let syncTimer = 0;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function decodeEmailFromToken() {
    const token = getToken();
    if (!token) return "";
    try {
      const payloadPart = token.split(".")[1] || "";
      const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const payload = JSON.parse(atob(padded));
      return String(payload?.email || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }

  function getGuestId() {
    let guestId = localStorage.getItem(GUEST_ID_KEY) || "";
    if (!guestId) {
      guestId = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(GUEST_ID_KEY, guestId);
    }
    return guestId;
  }

  function readCartItems() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readCouponState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(COUPON_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function getCouponCode() {
    return String(readCouponState()?.code || "").trim().toUpperCase();
  }

  function legacyItemToApiItem(item) {
    const quantity = Math.max(1, parseInt(String(item?.qty || item?.quantity || 1), 10));
    return {
      productId: String(item?.productId || item?.id || "").trim(),
      name: String(item?.name || item?.title || "Product").trim(),
      image: String(item?.image || "").trim(),
      quantity,
      size: String(item?.size || "").trim(),
      color: String(item?.color || "").trim(),
      variantId: String(item?.variantId || "").trim()
    };
  }

  function apiItemToLegacyItem(item) {
    const quantity = Math.max(1, parseInt(String(item?.quantity || item?.qty || 1), 10));
    const priceNgn = Number(item?.priceNgn ?? item?.price ?? 0);
    return {
      id: String(item?.productId || item?.id || ""),
      productId: String(item?.productId || item?.id || ""),
      variantId: String(item?.variantId || ""),
      name: String(item?.name || item?.title || "Product"),
      title: String(item?.name || item?.title || "Product"),
      color: String(item?.color || ""),
      size: String(item?.size || ""),
      image: String(item?.image || ""),
      alt: String(item?.name || item?.title || "Product"),
      category: String(item?.categoryId || "all"),
      categoryId: String(item?.categoryId || "all"),
      qty: quantity,
      quantity,
      price: priceNgn,
      priceNgn
    };
  }

  function applyServerCartToLocal(cart) {
    suppressSync = true;
    try {
      const items = Array.isArray(cart?.items) ? cart.items.map((item) => apiItemToLegacyItem(item)) : [];
      localStorage.setItem(CART_KEY, JSON.stringify(items));

      const appliedCoupon = cart?.summary?.appliedCoupon;
      if (appliedCoupon?.code) {
        localStorage.setItem(COUPON_KEY, JSON.stringify({
          code: String(appliedCoupon.code).trim().toUpperCase(),
          status: "validated",
          email: decodeEmailFromToken(),
          discountType: appliedCoupon.discountType,
          discountValue: appliedCoupon.discountValue,
          maximumDiscountAmount: appliedCoupon.maximumDiscountAmount,
          minimumOrderAmount: appliedCoupon.minimumOrderAmount,
          freeShipping: Boolean(appliedCoupon.freeShipping),
          appliedAt: new Date().toISOString(),
          message: String(cart?.summary?.couponMessage || "")
        }));
      } else {
        localStorage.removeItem(COUPON_KEY);
      }

      window.dispatchEvent(new CustomEvent("benzy:cart-updated"));
    } finally {
      window.setTimeout(function () {
        suppressSync = false;
      }, 0);
    }
  }

  async function requestCartApi(path, options, acceptedStatuses) {
    const token = getToken();
    const method = String(options?.method || "GET").toUpperCase();
    const accepted = Array.isArray(acceptedStatuses) ? acceptedStatuses : [];

    for (const base of API_BASES) {
      try {
        const response = await fetch(`${base}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: method === "GET" ? undefined : JSON.stringify(options?.body || {})
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok || accepted.includes(response.status)) {
          return { response, data };
        }
      } catch {
        // Try the next configured API base.
      }
    }

    throw new Error("Unable to reach the cart service.");
  }

  async function syncAuthenticatedCart() {
    if (!getToken()) return null;

    const payload = {
      items: readCartItems().map((item) => legacyItemToApiItem(item)),
      couponCode: getCouponCode(),
      guestId: getGuestId()
    };

    const { response, data } = await requestCartApi("/api/cart/sync", {
      method: "POST",
      body: payload
    }, [400, 401, 404, 409, 422]);

    if (response.ok && data?.cart) {
      applyServerCartToLocal(data.cart);
      return data.cart;
    }

    if (response.status === 401) return null;
    return null;
  }

  async function hydrateAuthenticatedCart() {
    if (!getToken()) return null;

    const localItems = readCartItems();
    if (localItems.length || getCouponCode()) {
      return syncAuthenticatedCart();
    }

    try {
      const { response, data } = await requestCartApi("/api/cart", {
        method: "GET"
      }, [401]);
      if (response.ok && data?.cart) {
        applyServerCartToLocal(data.cart);
        return data.cart;
      }
    } catch {
      // Keep the current local cart untouched if the cart API is unavailable.
    }

    return null;
  }

  async function handleLoginSuccess() {
    if (!getToken()) return null;

    const items = readCartItems().map((item) => legacyItemToApiItem(item));
    const couponCode = getCouponCode();

    if (!items.length && !couponCode) {
      return hydrateAuthenticatedCart();
    }

    try {
      const { response, data } = await requestCartApi("/api/cart/merge", {
        method: "POST",
        body: {
          guestCart: {
            items,
            couponCode
          },
          guestId: getGuestId()
        }
      }, [400, 401, 404, 409, 422]);

      if (response.ok && data?.cart) {
        applyServerCartToLocal(data.cart);
        return data.cart;
      }
    } catch {
      // Fall back to the local cart if merge fails.
    }

    return null;
  }

  function handleLogout() {
    suppressSync = true;
    try {
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem(COUPON_KEY);
      window.dispatchEvent(new CustomEvent("benzy:cart-updated"));
    } finally {
      window.setTimeout(function () {
        suppressSync = false;
      }, 0);
    }
  }

  function scheduleSync() {
    if (suppressSync || !getToken()) return;
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(function () {
      void syncAuthenticatedCart();
    }, 250);
  }

  window.BenzyCartBridge = {
    handleLoginSuccess,
    handleLogout,
    hydrateAuthenticatedCart,
    syncAuthenticatedCart
  };

  window.addEventListener("benzy:cart-updated", function () {
    scheduleSync();
  });

  window.addEventListener("benzy:auth-login", function () {
    void handleLoginSuccess();
  });

  window.addEventListener("benzy:auth-logout", function () {
    handleLogout();
  });

  if (getToken()) {
    void hydrateAuthenticatedCart();
  }
})();

