
const jira_upsert = (resource_type, id_ref, labels, values) => {
  const id_cell = SpreadsheetApp.getActive().getRange(id_ref);
  const id = id_cell.getValue();

  let payload = {};
  labels[0].forEach((label, i) => {
    const key = label.toLowerCase().replace(/ /, '')
    if (key !== "id") {
      payload[key] = values[0][i];
    }
  });
 
  if (id) {
    jira_api_request('PUT', `${resource_type}/${id}`, payload);
  } else {
    const result = JSON.parse(jira_api_request('POST', resource_type, payload));
    id_cell.setValue(result.id);
  }

  return '✅';
};

const jira_api_request = (method, path, payload) => {
  const jira_base_url = ScriptProperties.getProperty('JIRA_API_BASE_URL');
  const username = ScriptProperties.getProperty('JIRA_USER');
  const api_token = ScriptProperties.getProperty("JIRA_API_TOKEN");
  return UrlFetchApp.fetch(jira_base_url + '/' + path, {
      method,
      contentType: "application/json",
      headers: {
        Authorization: `Basic ${Utilities.base64Encode(`${username}:${api_token}`)}`,
        Accept: "application/json",
      },
      payload: JSON.stringify(payload),
    })
    .getContentText();
};


const jira_filter_metadata = jql => {
  const fields = JSON.parse(jira_api_request("GET", "field"));
  const [_, order_clause] = jql.match(/\s*order\s*by\s*(.*?)\s*$/) || ['', ''];
  const order_fields = order_clause.trim().split(/\s*,\s*/g).map(s => s
    .replace(/\s+(asc|desc)$/i, '')
    .replace(/^"|"$/g, '')
    .toLowerCase()
  );
  const order_field_ids = order_fields.map(order_field => (
    fields.find(({clauseNames}) => clauseNames.map(cn => cn.toLowerCase()).includes(order_field)).id
  ));

  const {issues, total} = JSON.parse(jira_api_request("GET", 'search?' + [
    `jql=${encodeURIComponent(jql)}`,
    `fields=${order_field_ids.join(',')}`,
    'maxResults=1',
  ].join('&')));

  const issueDates = issues.map(({fields}) => Object.values(fields)[0]).filter(val => !!val).sort().map(val => new Date(val));
  const date = issueDates.length > 0 ? issueDates[0] : undefined;
  const dateStr = date ? date.toISOString().substring(0, 10) + ' ' + date.toLocaleDateString('en-us', { weekday: 'short' }) : '';
  return [[
    dateStr,
    total,
  ]];
};


const jira_upsert_filter = (id, name, description, jql) => {
  return jira_api_request(id ? 'put' : 'post', 'filter' + (id ? `/${id}` : ''), {name, description, jql});
};

const jira_delete_filter = (id) => jira_api_request('delete', `filter/${id}`);

const jira_upsert_link_type = (id, name, inward, outward) => (
  jira_api_request(id ? 'put' : 'post', 'issueLinkType' + (id ? `/${id}` : ''), {id, name, inward, outward})
);