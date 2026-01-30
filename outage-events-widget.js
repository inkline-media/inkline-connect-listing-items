(function () {
  'use strict';

  function findScriptTag() {
    if (document.currentScript) {
      return document.currentScript;
    }
    var scripts = document.querySelectorAll('script[data-ghl-widget="outage-events"]');
    if (scripts.length > 0) {
      return scripts[scripts.length - 1];
    }
    return null;
  }

  function readConfig(script) {
    var dataset = (script && script.dataset) ? script.dataset : {};
    var pageLimit = parseInt(dataset.ghlPageLimit || '100', 10);
    if (!Number.isFinite(pageLimit) || pageLimit <= 0) {
      pageLimit = 100;
    }
    var maxPages = parseInt(dataset.ghlMaxPages || '20', 10);
    if (!Number.isFinite(maxPages) || maxPages <= 0) {
      maxPages = 20;
    }
    return {
      apiToken: dataset.ghlToken || '',
      locationId: dataset.ghlLocationId || '',
      schemaKey: dataset.ghlSchemaKey || 'custom_objects.outage_events',
      propertyKey: dataset.ghlPropertyKey || 'custom_objects.outage_events.outage_event_name',
      baseUrl: dataset.ghlBaseUrl || 'https://services.leadconnectorhq.com',
      version: dataset.ghlVersion || '2021-07-28',
      target: dataset.ghlTarget || '',
      title: dataset.ghlTitle || '',
      emptyText: dataset.ghlEmptyText || 'No outage events found.',
      maxPages: maxPages,
      pageLimit: pageLimit
    };
  }

  function ensureContainer(config) {
    var container = null;
    if (config.target) {
      container = document.querySelector(config.target);
    }
    if (!container) {
      container = document.createElement('div');
      container.id = 'ghl-outage-events';
      var scriptTag = findScriptTag();
      if (scriptTag && scriptTag.parentNode) {
        scriptTag.parentNode.insertBefore(container, scriptTag.nextSibling);
      } else {
        document.body.appendChild(container);
      }
    }
    return container;
  }

  function renderLoading(container) {
    container.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = 'Loading outage events...';
    container.appendChild(p);
  }

  function renderError(container, message) {
    container.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = message;
    container.appendChild(p);
  }

  function renderList(container, config, names) {
    container.innerHTML = '';

    if (config.title) {
      var h = document.createElement('h3');
      h.textContent = config.title;
      container.appendChild(h);
    }

    if (!names.length) {
      var empty = document.createElement('p');
      empty.textContent = config.emptyText;
      container.appendChild(empty);
      return;
    }

    var ul = document.createElement('ul');
    for (var i = 0; i < names.length; i += 1) {
      var li = document.createElement('li');
      li.textContent = names[i];
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

  function extractName(record, propertyKey) {
    if (!record) return null;
    var shortKey = propertyKey.split('.').pop();
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
      if (obj && Object.prototype.hasOwnProperty.call(obj, propertyKey)) {
        return obj[propertyKey];
      }
      if (obj && Object.prototype.hasOwnProperty.call(obj, shortKey)) {
        return obj[shortKey];
      }
    }

    if (Object.prototype.hasOwnProperty.call(record, propertyKey)) return record[propertyKey];
    if (Object.prototype.hasOwnProperty.call(record, shortKey)) return record[shortKey];

    if (record.name) return record.name;
    if (record.title) return record.title;
    if (record.displayName) return record.displayName;

    return null;
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
    var cursor = null;
    var page = 1;
    var maxPages = Math.max(1, config.maxPages || 1);

    for (var i = 0; i < maxPages; i += 1) {
      var payloads = [];

      if (cursor) {
        payloads.push({
          locationId: config.locationId,
          pageLimit: config.pageLimit,
          startAfterId: cursor
        });
        payloads.push({
          locationId: config.locationId,
          limit: config.pageLimit,
          startAfterId: cursor
        });
      } else {
        payloads.push({
          locationId: config.locationId,
          pageLimit: config.pageLimit
        });
        payloads.push({
          locationId: config.locationId,
          limit: config.pageLimit
        });
      }

      var responseData = null;
      var lastError = null;

      for (var p = 0; p < payloads.length; p += 1) {
        try {
          responseData = await apiRequest(config, payloads[p]);
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!responseData) {
        throw lastError || new Error('Unable to fetch records.');
      }

      var pageRecords = extractRecords(responseData);
      if (pageRecords.length) {
        records = records.concat(pageRecords);
      }

      cursor = extractNextCursor(responseData);
      if (!cursor && (!pageRecords || pageRecords.length < config.pageLimit)) {
        break;
      }

      page += 1;
    }

    return records;
  }

  async function init() {
    var scriptTag = findScriptTag();
    var config = readConfig(scriptTag);
    var container = ensureContainer(config);

    if (!config.apiToken || !config.locationId || !config.schemaKey) {
      renderError(container, 'Missing required configuration: api token, location id, or schema key.');
      return;
    }

    renderLoading(container);

    try {
      var records = await fetchAllRecords(config);
      var names = [];

      for (var i = 0; i < records.length; i += 1) {
        var name = extractName(records[i], config.propertyKey);
        if (name) names.push(String(name));
      }

      renderList(container, config, names);
    } catch (error) {
      renderError(container, 'Unable to load outage events: ' + error.message);
      if (window && window.console && console.error) {
        console.error('GHL Outage Events Widget error:', error);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
