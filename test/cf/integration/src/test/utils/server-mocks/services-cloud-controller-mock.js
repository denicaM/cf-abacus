'use strict';

const express = require('abacus-express');
const debug = require('abacus-debug')('cloud-controller-mock');
const randomPort = 0;

const createMockServiceData = require('./mock-service-data');

const convert = (serviceGuids) => {
  const resources = [];
  Object.keys(serviceGuids).forEach((serviceLabel) => {
    resources.push({
      entity: {
        label: serviceLabel
      },
      metadata: {
        guid: serviceGuids[serviceLabel]
      }
    });
  });
  return {
    resources
  };
};

// OAuth Authorization header format: "Bearer <token-value>"
const extractOAuthToken = (authHeader) => {
  if (authHeader) return authHeader.split(' ')[1];

  return undefined;
};

// Filter format is "label IN <label1,label2>"
const extractServiceLabels = (filter) => {
  return filter.substring('label IN '.length).split(',');
};

// Filter format is array of
// [ 'service_instance_type:managed_service_instance',
// 'service_guid IN test-service-guid,test-service-guid2' ]
const extractServiceGuids = (filter) => {
  return filter[1].substring('service_guid IN '.length).split(',');
};

module.exports = () => {
  let app;
  let server;

  const serviceUsageEventsData = createMockServiceData();
  const serviceGuidsData = createMockServiceData();
  let returnUaaAddress;

  const start = () => {
    app = express();

    app.get('/v2/info', (req, res) => {
      debug('Retrieving cf info...');
      res.send({
        token_endpoint: returnUaaAddress
      });
    });

    app.get('/v2/service_usage_events', (req, res) => {
      debug('Retrieved service usage events request. Query: %j', req.query);

      serviceUsageEventsData.requests().push({
        token: extractOAuthToken(req.header('Authorization')),
        serviceGuids: extractServiceGuids(req.query.q),
        afterGuid: req.query.after_guid
      });

      const currentRequestReturn = serviceUsageEventsData.nextResponse();
      const result = currentRequestReturn || [];
      debug('Returing service usage events: %j', result);
      res.send({
        resources: result
      });
    });

    app.get('/v2/services', (req, res) => {
      debug('Retrieved request for services. Headers: %j, Query params: %j', req.headers, req.query);

      serviceGuidsData.requests().push({
        token: extractOAuthToken(req.header('Authorization')),
        serviceLabels: extractServiceLabels(req.query.q)
      });

      const services = convert(serviceGuidsData.nextResponse());
      res.send(services);
    });

    server = app.listen(randomPort);
    debug('Cloud controller started on port: %d', server.address().port);
    return server.address();
  };

  const stop = (cb) => {
    server.close(cb);
  };

  return {
    start,
    address: () => server.address(),
    infoService: {
      returnUaaAddress: (value) => returnUaaAddress = value
    },
    serviceGuids: serviceGuidsData,
    usageEvents: serviceUsageEventsData,
    stop
  };
};
