(function () {
  'use strict';

  function findScriptTag() {
    if (document.currentScript) {
      return document.currentScript;
    }
    var scripts = document.querySelectorAll('script[data-inkline-widget="outage-events"], script[data-inkline-widget="service-status-events"], script[data-inkline-widget="inkline-listing-grid"], script[data-inkline-target]');
    if (scripts.length > 0) {
      return scripts[scripts.length - 1];
    }
    return null;
  }

  function normalizeTargetSelector(target) {
    if (!target) return '';
    if (target[0] === '#' || target[0] === '.' || target.indexOf(' ') !== -1) {
      return target;
    }
    return '#' + target;
  }

  function readConfig(script) {
    var dataset = (script && script.dataset) ? script.dataset : {};
    var pageLimit = parseInt(dataset.inklinePageLimit || '100', 10);
    if (!Number.isFinite(pageLimit) || pageLimit <= 0) {
      pageLimit = 100;
    }
    var maxPages = parseInt(dataset.inklineMaxPages || '20', 10);
    if (!Number.isFinite(maxPages) || maxPages <= 0) {
      maxPages = 20;
    }
    return {
      apiToken: dataset.inklineToken || '',
      locationId: dataset.inklineLocationId || '',
      schemaKey: dataset.inklineSchemaKey || 'custom_objects.service_status_events',
      titleKey: dataset.inklineTitleKey || 'custom_objects.service_status_events.event_title',
      descriptionKey: dataset.inklineDescriptionKey || 'custom_objects.service_status_events.event_description',
      dateKey: dataset.inklineDateKey || 'custom_objects.service_status_events.event_datetime',
      hourKey: dataset.inklineHourKey || 'custom_objects.service_status_events.event_hour',
      minutesKey: dataset.inklineMinutesKey || 'custom_objects.service_status_events.event_minutes',
      ampmKey: dataset.inklineAmpmKey || 'custom_objects.service_status_events.event_ampm',
      updatedAtKey: dataset.inklineUpdatedAtKey || '',
      templateUrl: dataset.inklineTemplateUrl || '',
      sortField: dataset.inklineSortField || '',
      sortOrder: (dataset.inklineSortOrder || '').toLowerCase(),
      baseUrl: dataset.inklineBaseUrl || 'https://services.leadconnectorhq.com',
      version: dataset.inklineVersion || '2021-07-28',
      target: normalizeTargetSelector(dataset.inklineTarget || ''),
      emptyText: dataset.inklineEmptyText || 'No outage events found.',
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
      container.id = 'inkline-listing-grid';
      var scriptTag = findScriptTag();
      if (scriptTag && scriptTag.dataset && scriptTag.dataset.inklineTarget) {
        var targetSelector = normalizeTargetSelector(scriptTag.dataset.inklineTarget);
        if (targetSelector && targetSelector[0] === '#') {
          container.id = targetSelector.slice(1);
          if (!scriptTag.id) {
            scriptTag.id = container.id + '-script';
          }
        }
      }
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
    p.textContent = 'Loading events...';
    container.appendChild(p);
  }

  function renderError(container, message) {
    container.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = message;
    container.appendChild(p);
  }

  function renderList(container, config, events) {
    container.innerHTML = '';

    if (!events.length) {
      var empty = document.createElement('p');
      empty.textContent = config.emptyText;
      container.appendChild(empty);
      return;
    }

    var ul = document.createElement('ul');
    for (var i = 0; i < events.length; i += 1) {
      var eventItem = events[i];
      var li = document.createElement('li');
      var title = document.createElement('div');
      title.textContent = eventItem.title || 'Untitled Event';
      li.appendChild(title);

      var details = document.createElement('ul');
      if (eventItem.description) {
        var descLi = document.createElement('li');
        descLi.textContent = 'Description: ' + eventItem.description;
        details.appendChild(descLi);
      }
      if (eventItem.eventDateTime) {
        var dateLi = document.createElement('li');
        dateLi.textContent = 'Event Date/Time: ' + eventItem.eventDateTime;
        details.appendChild(dateLi);
      }
      if (eventItem.updatedAt) {
        var updatedLi = document.createElement('li');
        updatedLi.textContent = 'Last Updated: ' + eventItem.updatedAt;
        details.appendChild(updatedLi);
      }

      if (details.childNodes.length) {
        li.appendChild(details);
      }
      ul.appendChild(li);
    }
    container.appendChild(ul);
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

  function extractUpdatedAt(record, fieldKey) {
    var fromField = extractField(record, fieldKey);
    if (fromField) return fromField;
    if (record && record.updatedAt) return record.updatedAt;
    if (record && record.updated_at) return record.updated_at;
    if (record && record.meta && record.meta.updatedAt) return record.meta.updatedAt;
    if (record && record.meta && record.meta.updated_at) return record.meta.updated_at;
    return null;
  }

  function formatEventDateTime(dateValue, hourValue, minutesValue, ampmValue) {
    if (!dateValue && !hourValue && !minutesValue && !ampmValue) return '';
    var dateText = dateValue ? String(dateValue) : '';
    var hourText = hourValue != null ? String(hourValue) : '';
    var minutesText = minutesValue != null ? String(minutesValue) : '';
    if (minutesText && minutesText.length === 1) {
      minutesText = '0' + minutesText;
    }
    var timeParts = [];
    if (hourText) timeParts.push(hourText);
    if (minutesText) timeParts.push(minutesText);
    var timeText = timeParts.length ? timeParts.join(':') : '';
    if (ampmValue) {
      timeText = timeText ? (timeText + ' ' + String(ampmValue)) : String(ampmValue);
    }
    if (dateText && timeText) return dateText + ' ' + timeText;
    return dateText || timeText;
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
      var updated = extractUpdatedAt(record, config.updatedAtKey);
      return updated ? formatDateTimeValue(updated) : '';
    }
    if (token === 'event_datetime') {
      return formatEventDateTime(
        extractField(record, config.dateKey),
        extractField(record, config.hourKey),
        extractField(record, config.minutesKey),
        extractField(record, config.ampmKey)
      );
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

      if (config.templateUrl) {
        var template = await loadTemplate(config.templateUrl);
        renderTemplateList(container, config, records, template);
      } else {
        var events = [];

        for (var i = 0; i < records.length; i += 1) {
          var record = records[i];
          var title = extractField(record, config.titleKey);
          var description = extractField(record, config.descriptionKey);
          var dateValue = extractField(record, config.dateKey);
          var hourValue = extractField(record, config.hourKey);
          var minutesValue = extractField(record, config.minutesKey);
          var ampmValue = extractField(record, config.ampmKey);
          var updatedAtValue = extractUpdatedAt(record, config.updatedAtKey);

          events.push({
            title: title ? String(title) : '',
            description: description ? String(description) : '',
            eventDateTime: formatEventDateTime(dateValue, hourValue, minutesValue, ampmValue),
            updatedAt: updatedAtValue ? formatDateTimeValue(updatedAtValue) : ''
          });
        }

        renderList(container, config, events);
      }
    } catch (error) {
      renderError(container, 'Unable to load events: ' + error.message);
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
