(function () {
  'use strict';

  // Shared configuration is supplied via window.InklineListingConfig.
  function getGlobalConfigDataset() {
    if (!window || !window.InklineListingConfig) {
      return null;
    }
    var cfg = window.InklineListingConfig || {};
    return {
      inklineToken: cfg.token,
      inklineLocationId: cfg.locationId,
      inklineSchemaKey: cfg.schemaKey,
      inklineTemplateUrl: cfg.templateUrl,
      inklineSortField: cfg.sortField,
      inklineSortOrder: cfg.sortOrder,
      inklinePageSize: cfg.pageSize,
      inklinePageLimit: cfg.pageLimit,
      inklineMaxPages: cfg.maxPages,
      inklineBaseUrl: cfg.baseUrl,
      inklineVersion: cfg.version,
      inklineEmptyText: cfg.emptyText,
      inklineDebug: cfg.debug,
      inklineCssUrl: cfg.cssUrl
    };
  }

  // Merge dataset values with defaults and normalize numeric fields.
  function readConfigFromDataset(dataset, defaults) {
    var source = dataset || {};
    var pageLimit = parseInt(source.inklinePageLimit || (defaults && defaults.pageLimit) || '100', 10);
    if (!Number.isFinite(pageLimit) || pageLimit <= 0) {
      pageLimit = 100;
    }
    var maxPages = parseInt(source.inklineMaxPages || (defaults && defaults.maxPages) || '20', 10);
    if (!Number.isFinite(maxPages) || maxPages <= 0) {
      maxPages = 20;
    }
    var pageSize = parseInt(source.inklinePageSize || (defaults && defaults.pageSize) || '10', 10);
    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      pageSize = 10;
    }
    return {
      apiToken: source.inklineToken || (defaults && defaults.apiToken) || '',
      locationId: source.inklineLocationId || (defaults && defaults.locationId) || '',
      schemaKey: source.inklineSchemaKey || (defaults && defaults.schemaKey) || 'custom_objects.service_status_events',
      templateUrl: source.inklineTemplateUrl || (defaults && defaults.templateUrl) || '',
      sortField: source.inklineSortField || (defaults && defaults.sortField) || '',
      sortOrder: (source.inklineSortOrder || (defaults && defaults.sortOrder) || '').toLowerCase(),
      baseUrl: source.inklineBaseUrl || (defaults && defaults.baseUrl) || 'https://services.leadconnectorhq.com',
      version: source.inklineVersion || (defaults && defaults.version) || '2021-07-28',
      emptyText: source.inklineEmptyText || (defaults && defaults.emptyText) || 'No outage events found.',
      maxPages: maxPages,
      pageLimit: pageLimit,
      pageSize: pageSize,
      debug: source.inklineDebug === 'true' || source.inklineDebug === true || (defaults && defaults.debug) || false,
      cssUrl: source.inklineCssUrl || (defaults && defaults.cssUrl) || ''
    };
  }

  // Lightweight debug logger controlled by config.debug.
  function logDebug(config, message, data) {
    if (!config || !config.debug || !window || !window.console || !console.log) return;
    if (typeof data !== 'undefined') {
      console.log('[Inkline Listing Grid]', message, data);
    } else {
      console.log('[Inkline Listing Grid]', message);
    }
  }

  // Use the listing element if provided; otherwise create a default container.
  function ensureContainer(listingElement) {
    if (listingElement) {
      return listingElement;
    }
    var container = document.createElement('div');
    container.id = 'inkline-listing-grid';
    document.body.appendChild(container);
    return container;
  }

  // Determine whether the target is part of a table structure.
  function isTableContainer(container) {
    var tag = container && container.tagName ? container.tagName.toLowerCase() : '';
    return tag === 'table' || tag === 'thead' || tag === 'tbody' || tag === 'tfoot' || tag === 'tr';
  }

  // Detect existing Font Awesome by checking loaded styles/scripts.
  function hasFontAwesome() {
    if (window && window.FontAwesome) return true;
    var links = document.querySelectorAll('link[rel~=\"stylesheet\"]');
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute('href') || '';
      if (href.indexOf('font-awesome') !== -1 || href.indexOf('fontawesome') !== -1) {
        return true;
      }
    }
    var scripts = document.querySelectorAll('script[src]');
    for (var j = 0; j < scripts.length; j += 1) {
      var src = scripts[j].getAttribute('src') || '';
      if (src.indexOf('font-awesome') !== -1 || src.indexOf('fontawesome') !== -1) {
        return true;
      }
    }
    return false;
  }

  // Inject an external stylesheet once if a URL is provided.
  function ensureExternalCss(url) {
    if (!url) return;
    var existing = document.querySelector('link[data-inkline-css]');
    if (existing) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-inkline-css', 'true');
    document.head.appendChild(link);
  }

  // Only inject Font Awesome if the page doesn't already include it.
  function ensureFontAwesome() {
    if (hasFontAwesome()) return;
    if (document.querySelector('link[data-inkline-fa]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    link.setAttribute('data-inkline-fa', 'true');
    document.head.appendChild(link);
  }

  // Inject minimal CSS once for the loading indicator.
  function ensureLoadingStyles() {
    if (document.querySelector('style[data-inkline-loading-style]')) return;
    var style = document.createElement('style');
    style.setAttribute('data-inkline-loading-style', 'true');
    style.textContent = ''
      + '.inkline-loading{display:flex;align-items:center;justify-content:center;width:100%;min-height:80px;}'
      + '.inkline-loading__text{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;}';
    document.head.appendChild(style);
  }

  // Show a spinner (or text fallback) while data loads.
  function renderLoading(container) {
    ensureFontAwesome();
    ensureLoadingStyles();
    var existing = container.querySelector('[data-inkline-loading]');
    if (existing) {
      if (hasFontAwesome()) {
        existing.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span class="inkline-loading__text">Loading data...</span>';
      } else {
        existing.textContent = 'Loading data...';
      }
      return;
    }
    var wrapper = document.createElement('div');
    wrapper.setAttribute('data-inkline-loading', 'true');
    wrapper.className = 'inkline-loading';
    if (hasFontAwesome()) {
      wrapper.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span class="inkline-loading__text">Loading data...</span>';
    } else {
      wrapper.textContent = 'Loading data...';
    }
    if (isTableContainer(container)) {
      container.insertAdjacentElement('afterend', wrapper);
    } else {
      container.appendChild(wrapper);
    }
  }

  // Remove loading indicator from the container or its immediate sibling.
  function removeLoading(container) {
    var loading = container.querySelector('[data-inkline-loading]');
    if (!loading && container.nextSibling && container.nextSibling.nodeType === 1) {
      if (container.nextSibling.hasAttribute('data-inkline-loading')) {
        loading = container.nextSibling;
      }
    }
    if (loading) {
      loading.parentNode.removeChild(loading);
    }
  }

  // Render a simple error message in the target container.
  function renderError(container, message) {
    container.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = message;
    container.appendChild(p);
  }

  // Render a single page of records using the provided template.
  function renderTemplateList(container, config, records, template, pageIndex) {
    removeLoading(container);

    if (!records.length) {
      if (!container.childNodes.length && config.emptyText && !isTableContainer(container)) {
        var empty = document.createElement('p');
        empty.textContent = config.emptyText;
        container.appendChild(empty);
      }
      return;
    }

    logDebug(config, 'Template preview', template.slice(0, 120));

    var start = (pageIndex || 0) * config.pageSize;
    var end = start + config.pageSize;
    var pageRecords = records.slice(start, end);

    var existingItems = container.querySelectorAll('[data-inkline-item]');
    for (var r = 0; r < existingItems.length; r += 1) {
      // Clear previously rendered items before inserting the new page.
      existingItems[r].parentNode.removeChild(existingItems[r]);
    }

    for (var i = 0; i < pageRecords.length; i += 1) {
      var html = buildTemplateHtml(pageRecords[i], template, config);
      if (html && html.trim()) {
        var wrapper = document.createElement('template');
        wrapper.innerHTML = html.trim();
        var fragment = wrapper.content.cloneNode(true);
        var first = fragment.firstElementChild;
        if (first) {
          // Mark rendered nodes for pagination cleanup.
          first.setAttribute('data-inkline-item', 'true');
        }
        container.appendChild(fragment);
      }
    }
    formatEventDates(container);
  }

  // Render paging controls after the target container.
  function renderPagination(container, config, totalRecords, onPageChange, currentPage) {
    ensureFontAwesome();
    var totalPages = Math.max(1, Math.ceil(totalRecords / config.pageSize));
    var existing = container.nextSibling && container.nextSibling.nodeType === 1
      ? container.nextSibling
      : null;
    if (existing && !existing.hasAttribute('data-inkline-pagination')) {
      existing = null;
    }
    if (!existing) {
      existing = document.createElement('div');
      existing.setAttribute('data-inkline-pagination', 'true');
      existing.className = 'inkline-pagination';
      container.insertAdjacentElement('afterend', existing);
    }

    if (totalPages <= 1) {
      existing.innerHTML = '';
      return;
    }

    existing.innerHTML = '';
    var prev = document.createElement('button');
    prev.type = 'button';
    prev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prev.setAttribute('data-inkline-page', 'prev');
    if (currentPage <= 0) {
      prev.disabled = true;
      prev.setAttribute('data-inkline-disabled', 'true');
    }
    existing.appendChild(prev);

    for (var i = 0; i < totalPages; i += 1) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(i + 1);
      btn.setAttribute('data-inkline-page', String(i));
      if (i === 0) {
        btn.setAttribute('data-inkline-active', 'true');
      }
      existing.appendChild(btn);
    }

    var next = document.createElement('button');
    next.type = 'button';
    next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    next.setAttribute('data-inkline-page', 'next');
    if (currentPage >= totalPages - 1) {
      next.disabled = true;
      next.setAttribute('data-inkline-disabled', 'true');
    }
    existing.appendChild(next);

    // Event delegation for pagination buttons.
    existing.addEventListener('click', function (event) {
      var target = event.target;
      if (!target) return;
      if (target.tagName.toLowerCase() === 'i') {
        target = target.parentNode;
      }
      if (!target || !target.hasAttribute('data-inkline-page')) return;
      if (target.disabled || target.hasAttribute('data-inkline-disabled')) return;
      var value = target.getAttribute('data-inkline-page');
      onPageChange(value);
    });
  }

  // Normalize API response shapes to a simple records array.
  function extractRecords(data) {
    if (!data) return [];
    if (Array.isArray(data.records)) return data.records;
    if (data.data && Array.isArray(data.data.records)) return data.data.records;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    return [];
  }

  // Not used currently, but kept for potential cursor-based paging.
  function extractNextCursor(data) {
    if (!data) return null;
    if (data.meta && data.meta.nextStartAfterId) return data.meta.nextStartAfterId;
    if (data.meta && data.meta.startAfterId) return data.meta.startAfterId;
    if (data.nextStartAfterId) return data.nextStartAfterId;
    if (data.startAfterId) return data.startAfterId;
    if (data.nextCursor) return data.nextCursor;
    if (data.cursor) return data.cursor;
    if (data.nextPage) return data.nextPage;
    return null;
  }

  // Read a field from common record shapes.
  function extractField(record, fieldKey) {
    if (!record || !fieldKey) return null;
    var shortKey = fieldKey.split('.').pop();
    var candidates = [
      record.properties,
      record.propertyValues,
      record.values,
      record.customFields,
      record.fields,
      record.data,
      record.attributes
    ];

    for (var i = 0; i < candidates.length; i += 1) {
      var obj = candidates[i];
      if (obj && Object.prototype.hasOwnProperty.call(obj, fieldKey)) {
        return obj[fieldKey];
      }
      if (obj && Object.prototype.hasOwnProperty.call(obj, shortKey)) {
        return obj[shortKey];
      }
    }

    if (Object.prototype.hasOwnProperty.call(record, fieldKey)) return record[fieldKey];
    if (Object.prototype.hasOwnProperty.call(record, shortKey)) return record[shortKey];

    return null;
  }

  // Extract updated timestamp from common fields.
  function extractUpdatedAt(record) {
    if (record && record.updatedAt) return record.updatedAt;
    if (record && record.updated_at) return record.updated_at;
    if (record && record.meta && record.meta.updatedAt) return record.meta.updatedAt;
    if (record && record.meta && record.meta.updated_at) return record.meta.updated_at;
    return null;
  }

  // Extract created timestamp from common fields.
  function extractCreatedAt(record) {
    if (record && record.createdAt) return record.createdAt;
    if (record && record.created_at) return record.created_at;
    if (record && record.createdOn) return record.createdOn;
    if (record && record.created_on) return record.created_on;
    if (record && record.createdTime) return record.createdTime;
    if (record && record.created_time) return record.created_time;
    if (record && record.meta && record.meta.createdAt) return record.meta.createdAt;
    if (record && record.meta && record.meta.created_at) return record.meta.created_at;
    if (record && record.meta && record.meta.createdOn) return record.meta.createdOn;
    if (record && record.meta && record.meta.created_on) return record.meta.created_on;
    return null;
  }

  // Convert ISO strings to a localized string when possible.
  function formatDateTimeValue(value) {
    if (!value) return '';
    var date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString();
    }
    return String(value);
  }

  // Event Date formatting
  function formatEventDateValue(value) {
  if (!value) return '';

  var date = new Date(value);

  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  return String(value);
}

function formatEventDates(container) {
  container
    .querySelectorAll(".listing-grid-item__details__event-date")
    .forEach(el => {
      var raw = el.textContent.trim();
      if (!raw) return;

      el.textContent = formatEventDateValue(raw);
    });
}


  // Basic HTML escaping for token substitution safety.
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Resolve a single token to its value.
  function getTokenValue(record, token, config) {
    if (token === 'updatedAt' || token === 'updated_at') {
      var updated = extractUpdatedAt(record);
      return updated ? formatDateTimeValue(updated) : '';
    }
    if (token === 'createdAt' || token === 'created_at') {
      var created = extractCreatedAt(record);
      return created ? formatDateTimeValue(created) : '';
    }
    var value = extractField(record, token);
    if (value == null) return '';
    return value;
  }

  // Replace all {{ token }} instances with values.
  function buildTemplateHtml(record, template, config) {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (match, token) {
      var rawValue = getTokenValue(record, token, config);
      if (rawValue == null) return '';
      return escapeHtml(rawValue);
    });
  }

  // Fetch the template HTML from a public URL.
  async function loadTemplate(url) {
    var response = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!response.ok) {
      throw new Error('Template request failed (' + response.status + ').');
    }
    return response.text();
  }

  // Perform an authenticated API request to Inkline Connect.
  async function apiRequest(config, payload) {
    var url = config.baseUrl.replace(/\/$/, '') + '/objects/' + encodeURIComponent(config.schemaKey) + '/records/search';

    var response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Authorization': 'Bearer ' + config.apiToken,
        'Version': config.version,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    var text = await response.text();
    var data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      var message = 'Request failed (' + response.status + ').';
      if (data && data.message) {
        if (Array.isArray(data.message)) {
          message = data.message.join(', ');
        } else {
          message = data.message;
        }
      }
      var error = new Error(message);
      error.response = data;
      throw error;
    }

    return data;
  }

  // Fetch all pages from the API (server-side paging).
  async function fetchAllRecords(config) {
    var records = [];
    var page = 1;
    var maxPages = Math.max(1, config.maxPages || 1);

    for (var i = 0; i < maxPages; i += 1) {
      var payload = {
        locationId: config.locationId,
        page: page,
        pageLimit: config.pageLimit
      };

      if (config.sortField) {
        // Allow full field keys in config, but send short key to API.
        var sortField = config.sortField;
        if (sortField.indexOf('.') !== -1) {
          sortField = sortField.split('.').pop();
        }
        payload.sort = [{
          field: sortField,
          direction: config.sortOrder === 'desc' ? 'desc' : 'asc'
        }];
      }

      var responseData = await apiRequest(config, payload);

      var pageRecords = extractRecords(responseData);
      if (pageRecords.length) {
        records = records.concat(pageRecords);
      }

      if (!pageRecords || pageRecords.length < config.pageLimit) {
        break;
      }

      page += 1;
    }

    return records;
  }

  // Initialize a single listing block.
  async function initListing(config, listingElement) {
    var container = ensureContainer(listingElement);
    ensureExternalCss(config.cssUrl);

    logDebug(config, 'Resolved config', {
      hasToken: !!config.apiToken,
      locationId: config.locationId,
      schemaKey: config.schemaKey,
      templateUrl: config.templateUrl,
      sortField: config.sortField,
      sortOrder: config.sortOrder,
      pageLimit: config.pageLimit,
      maxPages: config.maxPages,
      pageSize: config.pageSize
    });

    if (!config.apiToken || !config.locationId || !config.schemaKey) {
      renderError(container, 'Missing required configuration: api token, location id, or schema key.');
      return;
    }

    if (!config.templateUrl) {
      renderError(container, 'Missing required configuration: template URL.');
      return;
    }

    renderLoading(container);

    try {
      var records = await fetchAllRecords(config);
      if (config.debug && records && records.length) {
        var first = records[0] || {};
        var meta = first.meta || {};
        logDebug(config, 'First record keys', Object.keys(first));
        logDebug(config, 'First record meta keys', Object.keys(meta));
        logDebug(config, 'First record createdAt', extractCreatedAt(first));
        logDebug(config, 'First record updatedAt', extractUpdatedAt(first));
      }

      var template = await loadTemplate(config.templateUrl);
      var currentPage = 0;

      // Handle pagination changes and re-render the current page.
      var updatePage = function (value) {
        var totalPages = Math.max(1, Math.ceil(records.length / config.pageSize));
        if (value === 'prev') {
          currentPage = Math.max(0, currentPage - 1);
        } else if (value === 'next') {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        } else {
          var index = parseInt(value, 10);
          if (!isNaN(index)) currentPage = Math.min(Math.max(index, 0), totalPages - 1);
        }
        renderTemplateList(container, config, records, template, currentPage);
        var pagination = container.nextSibling && container.nextSibling.nodeType === 1
          ? container.nextSibling
          : null;
        if (pagination && pagination.hasAttribute('data-inkline-pagination')) {
          var buttons = pagination.querySelectorAll('button[data-inkline-page]');
          for (var i = 0; i < buttons.length; i += 1) {
            var btn = buttons[i];
            if (btn.getAttribute('data-inkline-page') === String(currentPage)) {
              btn.setAttribute('data-inkline-active', 'true');
            } else {
              btn.removeAttribute('data-inkline-active');
            }
            var pageAttr = btn.getAttribute('data-inkline-page');
            if (pageAttr === 'prev') {
              if (currentPage <= 0) {
                btn.disabled = true;
                btn.setAttribute('data-inkline-disabled', 'true');
              } else {
                btn.disabled = false;
                btn.removeAttribute('data-inkline-disabled');
              }
            } else if (pageAttr === 'next') {
              var totalPages = Math.max(1, Math.ceil(records.length / config.pageSize));
              if (currentPage >= totalPages - 1) {
                btn.disabled = true;
                btn.setAttribute('data-inkline-disabled', 'true');
              } else {
                btn.disabled = false;
                btn.removeAttribute('data-inkline-disabled');
              }
            }
          }
        }
      };

      renderTemplateList(container, config, records, template, currentPage);
      renderPagination(container, config, records.length, updatePage, currentPage);
    } catch (error) {
      removeLoading(container);
      renderError(container, 'Unable to load data: ' + error.message);
      if (window && window.console && console.error) {
        console.error('Inkline Listing Grid Widget error:', error);
      }
    }
  }

  // Build global defaults from window.InklineListingConfig, then init listings.
  async function init() {
    var globalDataset = getGlobalConfigDataset();
    var defaults = readConfigFromDataset(globalDataset || {}, null);
    var listingBlocks = document.querySelectorAll('[data-inkline-listing]');

    if (!listingBlocks.length) {
      await initListing(defaults, null);
      return;
    }

    for (var i = 0; i < listingBlocks.length; i += 1) {
      var block = listingBlocks[i];
      var mergedConfig = readConfigFromDataset(block.dataset, defaults);
      await initListing(mergedConfig, block);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
