(function () {
  'use strict';

  function findScriptTag() {
    if (document.currentScript) {
      return document.currentScript;
    }
    var scripts = document.querySelectorAll('script[data-inkline-token], script[data-inkline-location-id], script[data-inkline-base-url], script[data-inkline-version]');
    if (scripts.length > 0) {
      return scripts[scripts.length - 1];
    }
    var srcScripts = document.querySelectorAll('script[src*="outage-events-widget.js"]');
    if (srcScripts.length > 0) {
      return srcScripts[srcScripts.length - 1];
    }
    return null;
  }

  function findConfigScriptTag() {
    var scripts = document.querySelectorAll('script[data-inkline-token], script[data-inkline-location-id]');
    if (scripts.length > 0) {
      return scripts[scripts.length - 1];
    }
    return null;
  }

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
      inklinePageLimit: cfg.pageLimit,
      inklineMaxPages: cfg.maxPages,
      inklineBaseUrl: cfg.baseUrl,
      inklineVersion: cfg.version,
      inklineEmptyText: cfg.emptyText,
      inklineDebug: cfg.debug
    };
  }

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
      debug: source.inklineDebug === 'true' || source.inklineDebug === true || (defaults && defaults.debug) || false
    };
  }

  function logDebug(config, message, data) {
    if (!config || !config.debug || !window || !window.console || !console.log) return;
    if (typeof data !== 'undefined') {
      console.log('[Inkline Listing Grid]', message, data);
    } else {
      console.log('[Inkline Listing Grid]', message);
    }
  }

  function readConfig(script) {
    var dataset = (script && script.dataset) ? script.dataset : {};
    return readConfigFromDataset(dataset, null);
  }

  function ensureContainer(listingElement) {
    if (listingElement) {
      return listingElement;
    }
    var container = document.createElement('div');
    container.id = 'inkline-listing-grid';
    var scriptTag = findScriptTag();
    if (scriptTag && scriptTag.parentNode) {
      scriptTag.parentNode.insertBefore(container, scriptTag.nextSibling);
    } else {
      document.body.appendChild(container);
    }
    return container;
  }

  function renderLoading(container) {
    container.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = 'Loading events...';
    container.appendChild(p);
  }

  function renderError(container, message) {
    container.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = message;
    container.appendChild(p);
  }

  function renderTemplateList(container, config, records, template) {
    container.innerHTML = '';

    if (!records.length) {
      var empty = document.createElement('p');
      empty.textContent = config.emptyText;
      container.appendChild(empty);
      return;
    }

    var ul = document.createElement('ul');
    for (var i = 0; i < records.length; i += 1) {
      var li = document.createElement('li');
      li.innerHTML = buildTemplateHtml(records[i], template, config);
      ul.appendChild(li);
    }
    container.appendChild(ul);
  }

  function extractRecords(data) {
    if (!data) return [];
    if (Array.isArray(data.records)) return data.records;
    if (data.data && Array.isArray(data.data.records)) return data.data.records;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    return [];
  }

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

  function extractUpdatedAt(record) {
    if (record && record.updatedAt) return record.updatedAt;
    if (record && record.updated_at) return record.updated_at;
    if (record && record.meta && record.meta.updatedAt) return record.meta.updatedAt;
    if (record && record.meta && record.meta.updated_at) return record.meta.updated_at;
    return null;
  }

  function extractCreatedAt(record) {
    if (record && record.createdAt) return record.createdAt;
    if (record && record.created_at) return record.created_at;
    if (record && record.meta && record.meta.createdAt) return record.meta.createdAt;
    if (record && record.meta && record.meta.created_at) return record.meta.created_at;
    return null;
  }

  function formatDateTimeValue(value) {
    if (!value) return '';
    var date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString();
    }
    return String(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

  function buildTemplateHtml(record, template, config) {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (match, token) {
      var rawValue = getTokenValue(record, token, config);
      if (rawValue == null) return '';
      return escapeHtml(rawValue);
    });
  }

  async function loadTemplate(url) {
    var response = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!response.ok) {
      throw new Error('Template request failed (' + response.status + ').');
    }
    return response.text();
  }

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
        payload.sort = [{
          field: config.sortField,
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

  async function initListing(config, listingElement) {
    var container = ensureContainer(listingElement);

    logDebug(config, 'Resolved config', {
      hasToken: !!config.apiToken,
      locationId: config.locationId,
      schemaKey: config.schemaKey,
      templateUrl: config.templateUrl,
      sortField: config.sortField,
      sortOrder: config.sortOrder,
      pageLimit: config.pageLimit,
      maxPages: config.maxPages
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

      var template = await loadTemplate(config.templateUrl);
      renderTemplateList(container, config, records, template);
    } catch (error) {
      renderError(container, 'Unable to load events: ' + error.message);
      if (window && window.console && console.error) {
        console.error('Inkline Listing Grid Widget error:', error);
      }
    }
  }

  async function init() {
    var scriptTag = findScriptTag();
    var defaults = readConfig(scriptTag);
    if (!defaults.apiToken || !defaults.locationId) {
      var configScript = findConfigScriptTag();
      if (configScript && configScript !== scriptTag) {
        defaults = readConfig(configScript);
      }
    }
    if (!defaults.apiToken || !defaults.locationId) {
      var globalDataset = getGlobalConfigDataset();
      if (globalDataset) {
        defaults = readConfigFromDataset(globalDataset, defaults);
      }
    }
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
