// feedback-widget.js – vanilla-JS logic for the feedback popup.
(function () {
  const $ = (id) => document.getElementById(id);
  const qs = (sel, ctx = document) => ctx.querySelector(sel);

  let widgetInitialized = false;
  let initAttempts = 0;
  const maxInitAttempts = 5;

  function createDebugBanner(message) {
    if (!window.WD_FEEDBACK_DEBUG || !document.body) {
      return;
    }
    const existing = document.getElementById('fb-debug-banner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.id = 'fb-debug-banner';
    banner.textContent = message;
    banner.style.position = 'fixed';
    banner.style.bottom = '10px';
    banner.style.left = '10px';
    banner.style.padding = '8px 12px';
    banner.style.background = 'rgba(0,0,0,0.75)';
    banner.style.color = 'white';
    banner.style.fontSize = '12px';
    banner.style.zIndex = '10000';
    banner.style.borderRadius = '8px';
    banner.style.fontFamily = 'sans-serif';
    document.body.appendChild(banner);
  }

  console.log('[Feedback Widget] script loaded', window.location.href, 'readyState=', document.readyState);

  function noOp() {}
  window.showWishDoraFeedback = noOp;

  function injectFeedbackMarkup() {
    if (!document.body) {
      console.warn('[Feedback Widget] body not ready; cannot inject markup yet');
      return false;
    }

    const requiredIds = [
      'fb-backdrop', 'fb-close', 'fb-stars', 'fb-later', 'fb-submit',
      'fb-toggle-suggestion', 'fb-suggestion', 'fb-msg', 'fb-recommend',
    ];
    const existingBackdrop = document.getElementById('fb-backdrop');
    const hasCompleteMarkup = !!existingBackdrop &&
      requiredIds.slice(1).every((id) => existingBackdrop.querySelector(`#${id}`));

    if (hasCompleteMarkup) return existingBackdrop;

    // A partial/old backdrop can remain in the page and previously prevented
    // the widget from creating its controls. Remove it, then rebuild cleanly.
    if (existingBackdrop) {
      console.warn('[Feedback Widget] replacing incomplete feedback markup');
      existingBackdrop.remove();
    }
    requiredIds.slice(1).forEach((id) => document.getElementById(id)?.remove());

    const html = `
      <div id="fb-backdrop" class="fb-backdrop" style="display:none;">
        <div class="fb-modal" role="dialog" aria-modal="true" aria-labelledby="fb-title">
          <button class="fb-close" aria-label="Close" id="fb-close">✕</button>
          <h2 class="fb-title" id="fb-title">💜 Enjoying WishDora?</h2>
          <p class="fb-subtitle">How was your experience?</p>
          <div class="fb-stars" role="radiogroup" aria-label="Star rating" id="fb-stars"></div>
          <div class="fb-radio-group">
            <p>Would gift store recommendations be useful?</p>
            <label><input type="radio" name="storeRec" value="Yes" /> Yes</label>
            <label><input type="radio" name="storeRec" value="Maybe" /> Maybe</label>
            <label><input type="radio" name="storeRec" value="No" /> No</label>
          </div>
          <div class="fb-suggestion-toggle" id="fb-toggle-suggestion">💡 Have a suggestion?</div>
          <textarea class="fb-suggestion" id="fb-suggestion" placeholder="Your suggestion..." style="display:none;"></textarea>
          <label class="fb-checkbox">
            <input type="checkbox" id="fb-recommend" />
             I would recommend WishDora to a friend
          </label>
          <div id="fb-msg" class="fb-msg" role="alert" aria-live="polite"></div>
          <div class="fb-buttons">
            <button class="fb-btn fb-btn-secondary" id="fb-later">Later</button>
            <button class="fb-btn fb-btn-primary" id="fb-submit">Submit Feedback</button>
          </div>
        </div>
      </div>
    `;
    // Keep the new node as the source of truth.  Looking the controls up again
    // from `document` is fragile on pages that are still replacing DOM content.
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const injectedBackdrop = template.content.firstElementChild;
    document.body.appendChild(injectedBackdrop);
    const injectedSuccessfully = injectedBackdrop.id === 'fb-backdrop' &&
      requiredIds.slice(1).every((id) => injectedBackdrop.querySelector(`#${id}`));
    if (!injectedSuccessfully) {
      console.error('[Feedback Widget] could not inject complete feedback markup');
      injectedBackdrop.remove();
      return false;
    }
    console.log('[Feedback Widget] injected missing markup');
    return injectedBackdrop;
  }

  function initFeedbackWidget() {
    if (widgetInitialized) return;
    console.log('[Feedback Widget] initFeedbackWidget start', {
      readyState: document.readyState,
      bodyReady: !!document.body,
      fbElementsBefore: {
        backdrop: !!document.getElementById('fb-backdrop'),
        closeBtn: !!document.getElementById('fb-close'),
        stars: !!document.getElementById('fb-stars'),
        later: !!document.getElementById('fb-later'),
        submit: !!document.getElementById('fb-submit'),
        toggle: !!document.getElementById('fb-toggle-suggestion'),
        suggestion: !!document.getElementById('fb-suggestion'),
        msg: !!document.getElementById('fb-msg'),
        recommend: !!document.getElementById('fb-recommend'),
      },
    });
    createDebugBanner('[Feedback Widget] init started');

    try {
      const widgetRoot = injectFeedbackMarkup();
      if (!widgetRoot) {
        console.warn('[Feedback Widget] skipped init because DOM body was not ready');
        return;
      }

      // Scope every lookup to this widget. This avoids collisions with stale
      // copies of the popup left behind by navigation or page-level scripts.
      const widgetElement = (id) => widgetRoot.querySelector(`#${id}`);
      const backdrop = widgetRoot;
      const closeBtn = widgetElement('fb-close');
      const starsContainer = widgetElement('fb-stars');
      const laterBtn = widgetElement('fb-later');
      const submitBtn = widgetElement('fb-submit');
      const suggestionToggle = widgetElement('fb-toggle-suggestion');
      const suggestionBox = widgetElement('fb-suggestion');
      const msgBox = widgetElement('fb-msg');
      const recommendCheckbox = widgetElement('fb-recommend');

      const foundStates = {
        backdrop: !!backdrop,
        closeBtn: !!closeBtn,
        starsContainer: !!starsContainer,
        laterBtn: !!laterBtn,
        submitBtn: !!submitBtn,
        suggestionToggle: !!suggestionToggle,
        suggestionBox: !!suggestionBox,
        msgBox: !!msgBox,
        recommendCheckbox: !!recommendCheckbox,
        fbIds: Array.from(document.querySelectorAll('[id^="fb-"]')).map(el => el.id),
      };
      console.log('[Feedback Widget] selected elements', foundStates);

      if (!backdrop || !closeBtn || !starsContainer || !laterBtn || !submitBtn || !suggestionToggle || !suggestionBox || !msgBox || !recommendCheckbox) {
        console.warn('[Feedback Widget] required DOM elements missing after injection', foundStates);
        createDebugBanner('[Feedback Widget] init skipped: missing DOM elements');
        // A page may be hydrating/replacing its body while this script loads.
        // Retry instead of leaving the public show function as a no-op forever.
        setTimeout(scheduleInit, 250);
        return;
      }

      let rating = 0;
      let hoverRating = 0;

      function renderStars() {
        starsContainer.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
          const span = document.createElement('span');
          span.className = 'fb-star';
          span.dataset.value = i;
          span.textContent = i <= (hoverRating || rating) ? '★' : '☆';
          span.classList.toggle('active', i <= rating);
          span.classList.toggle('inactive', i > rating);
          span.tabIndex = 0;
          span.setAttribute('role', 'radio');
          span.setAttribute('aria-checked', i === rating);
          span.addEventListener('mouseenter', () => { hoverRating = i; renderStars(); });
          span.addEventListener('mouseleave', () => { hoverRating = 0; renderStars(); });
          span.addEventListener('click', () => { rating = i; renderStars(); });
          span.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              rating = i;
              renderStars();
            }
          });
          starsContainer.appendChild(span);
        }
      }

      function toggleSuggestion() {
        const visible = suggestionBox.style.display !== 'none';
        suggestionBox.style.display = visible ? 'none' : 'block';
        if (!visible) suggestionBox.focus();
      }

      function hideWidget() {
        backdrop.style.display = 'none';
        console.log('[Feedback Widget] hideWidget called');
      }

      function showWidget() {
        const existingBackdrop = $('#fb-backdrop');
        if (!existingBackdrop) {
          const injected = injectFeedbackMarkup();
          if (!injected) return;
        }

        const activeBackdrop = $('#fb-backdrop');
        console.log('[Feedback Widget] showWidget called', {
          backdropExists: !!activeBackdrop,
          currentDisplay: activeBackdrop?.style.display,
          computedDisplay: activeBackdrop ? window.getComputedStyle(activeBackdrop).display : 'none',
        });
        createDebugBanner('[Feedback Widget] showing feedback popup');
        activeBackdrop.style.display = 'flex';
      }

      window.showWishDoraFeedback = showWidget;
      closeBtn.addEventListener('click', hideWidget);
      laterBtn.addEventListener('click', () => {
        const hideUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem('wishdoraFeedbackLater', hideUntil.toString());
        hideWidget();
      });

      async function submitFeedback() {
        const storeRec = qs('input[name="storeRec"]:checked');
        if (!rating) return showMessage('Please select a rating.', 'error');
        if (!storeRec) return showMessage('Please answer the store recommendation question.', 'error');

        const storedUser = JSON.parse(localStorage.getItem('wd_user') || 'null');
        const payload = {
          userName: window.USER?.name || storedUser?.name || '',
          userEmail: window.USER?.email || storedUser?.email || '',
          userId: window.USER?.id || storedUser?.id || storedUser?._id || '',
          rating,
          storeRecommendation: storeRec.value,
          suggestion: suggestionBox.value.trim(),
          recommendFriend: recommendCheckbox.checked,
        };

        submitBtn.disabled = true;
        try {
          const res = await fetch(`${getApiBase()}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message || 'Server error');
          showMessage('💜 Thank you for your feedback! Your feedback has been received and will help us improve WishDora.', 'success');
          localStorage.setItem('wishdoraFeedbackSubmitted', Date.now().toString());
        } catch (e) {
          showMessage(e.message || 'Failed to submit feedback. Please try again later.', 'error');
        } finally {
          submitBtn.disabled = false;
        }
      }

      function showMessage(text, type) {
        msgBox.textContent = text;
        msgBox.className = `fb-msg ${type}`;
      }

      function shouldShow() {
        const later = parseInt(localStorage.getItem('wishdoraFeedbackLater') || '0', 10);
        const submitted = parseInt(localStorage.getItem('wishdoraFeedbackSubmitted') || '0', 10);
        if (later && Date.now() < later) return false;
        // Allow feedback again after 30 days instead of blocking permanently
        if (submitted && Date.now() - submitted < 30 * 24 * 60 * 60 * 1000) return false;
        return true;
      }

      widgetInitialized = true;

      function getApiBase() {
        const configured = window.WD_API_BASE || window.API_BASE_URL || window.API_BASE;
        if (configured) return configured.replace(/\/$/, '');
        // api.js defines API_BASE as a global lexical constant, not a window property.
        // Prefer it so a frontend served from another local origin still submits to the backend.
        if (typeof API_BASE !== 'undefined') return API_BASE.replace(/\/$/, '');
        if (window.location.origin && window.location.origin !== 'null') {
          return `${window.location.origin}/api`;
        }
        return 'http://localhost:5000/api';
      }

      function getAutoShowDelay() {
        const raw = Number(window.WD_FEEDBACK_SHOW_DELAY_MS);
        return Number.isFinite(raw) && raw >= 0 ? raw : 2500;
      }

      function hasPendingFeedbackEvent() {
        return localStorage.getItem('wishdoraFeedbackAfterWish') === '1' || localStorage.getItem('wishdoraFeedbackAfterLogin') === '1';
      }

      function clearPendingFeedbackEvent() {
        localStorage.removeItem('wishdoraFeedbackAfterWish');
        localStorage.removeItem('wishdoraFeedbackAfterLogin');
      }

      function hasQueryFeedbackTrigger() {
        const params = new URLSearchParams(window.location.search);
        return params.get('showFeedback') === '1';
      }

      function clearQueryFeedbackTrigger() {
        if (window.location.search.includes('showFeedback=1')) {
          const cleanUrl = window.location.href.split('?')[0] + window.location.hash;
          history.replaceState(null, '', cleanUrl);
        }
      }

      suggestionToggle.addEventListener('click', toggleSuggestion);
      submitBtn.addEventListener('click', submitFeedback);

      const storageTrigger = hasPendingFeedbackEvent();
      const queryTrigger = hasQueryFeedbackTrigger();
      console.log('[Feedback Widget] init:', {
        storageTrigger,
        queryTrigger,
        search: window.location.search,
        later: localStorage.getItem('wishdoraFeedbackLater'),
        submitted: localStorage.getItem('wishdoraFeedbackSubmitted'),
      });

      // Determine if we have an explicit trigger (login, wish schedule, or URL param)
      const hasExplicitTrigger = storageTrigger || queryTrigger;
      const shouldAutoShow = window.WD_FEEDBACK_AUTO_SHOW !== false && hasExplicitTrigger;

      if (shouldAutoShow) {
        // Clear triggers AFTER capturing them, but BEFORE showing
        clearPendingFeedbackEvent();

        // For explicit triggers (login/wish/query param), ALWAYS show the popup
        // regardless of prior submission — the user just completed an action
        console.log('[Feedback Widget] explicit trigger detected, will force-show', { storageTrigger, queryTrigger });
        createDebugBanner('[Feedback Widget] force-show due to trigger');

        // Clean up URL param after we've captured it
        clearQueryFeedbackTrigger();

        const delay = queryTrigger ? 1200 : getAutoShowDelay();
        setTimeout(() => { showWidget(); }, delay);
      } else if (shouldShow()) {
        // No explicit trigger but widget hasn't been shown/submitted recently
        // — show after the default delay (passive auto-show)
        console.log('[Feedback Widget] passive auto-show after delay');
        createDebugBanner('[Feedback Widget] passive auto-show after delay');
        setTimeout(() => { showWidget(); }, getAutoShowDelay());
      }

      renderStars();
    } catch (error) {
      console.error('[Feedback Widget] initFeedbackWidget error', error);
      createDebugBanner('[Feedback Widget] init error: ' + (error?.message || error));
    }
  }

  function scheduleInit() {
    initAttempts += 1;
    if (widgetInitialized) return;
    if (document.body || document.readyState !== 'loading') {
      initFeedbackWidget();
      return;
    }
    if (initAttempts < maxInitAttempts) {
      console.log('[Feedback Widget] retrying init, attempt', initAttempts);
      setTimeout(scheduleInit, 500);
    } else {
      console.error('[Feedback Widget] failed to initialize after retries');
      createDebugBanner('[Feedback Widget] failed to initialize after retries');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInit);
    window.addEventListener('load', scheduleInit);
    setTimeout(scheduleInit, 3000);
  } else {
    scheduleInit();
  }
})();
