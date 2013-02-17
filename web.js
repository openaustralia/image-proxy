// @see https://devcenter.heroku.com/articles/nodejs#write-your-app

var express = require('express')
  , fs      = require('fs') // node
  , gm      = require('gm')
  , http    = require('http') // node
  , https   = require('https') // node
  , mime    = require('mime') // express
  , url     = require('url') // node
  // @see http://aaronheckmann.posterous.com/graphicsmagick-on-heroku-with-nodejs
  , imageMagick = gm.subClass({imageMagick: true})
  , app = express.createServer(express.logger())
  , mimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/jpg',
  ];

app.get('/:url/:width/:height', function (req, res, next) {
  var remote = req.params.url
    , width = req.params.width
    , height = req.params.height;

  // Validate query string parameters.
  var parts = url.parse(remote);
  // @see http://nodejs.org/api/url.html#url_url
  if (['https:', 'http:'].indexOf(parts['protocol']) === -1) {
    return res.send('Expected url to use the HTTP or HTTPS protocol', 404);
  }
  if (!parts['hostname']) {
    return res.send('Expected url to include a hostname', 404);
  }
  if (isNaN(parseFloat(width))) {
    return res.send('Expected width to be an integer', 404);
  }
  if (isNaN(parseFloat(height))) {
    return res.send('Expected height to be an integer', 404);
  }

  var agent = parts['protocol'] === 'http:' ? http : https;

  // @see http://nodejs.org/api/http.html#http_http_get_options_callback
  agent.get(remote, function (res2) {
    // The remote image must return status code 200.
    // @see http://nodejs.org/api/http.html#http_response_statuscode
    if (res2.statusCode !== 200) {
      return res.send('Expected response code 200, got ' + res2.statusCode, 404);
    }

    // The remote image must be a valid content type.
    // @see http://nodejs.org/api/http.html#http_request_headers
    var mimeType = res2.headers['content-type'];
    if (mimeTypes.indexOf(mimeType) === -1) {
      return res.send('Expected content type ' + mimeTypes.join(', ') + ', got ' + mimeType, 404);
    }

    // @see https://github.com/aheckmann/gm#constructor
    imageMagick(res2, 'image.' + mime.extension(mimeType))
    // @see http://www.imagemagick.org/Usage/thumbnails/#cut
    .resize(width, height + '^>')
    .gravity('Center')
    .extent(width, height)
    .stream(function (err, stdout, stderr) {
      if (err) return next(err);
      stderr.pipe(process.stderr);
      // @see http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': 'max-age=31536000, public', // 1 year
      });
      stdout.pipe(res);
    });
  }).on('error', next);
});

var port = process.env.PORT || 5000;
app.listen(port, function () {
  console.log('Listening on ' + port);
});
