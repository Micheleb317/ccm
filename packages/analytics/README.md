# Complete analytics integration for Meteor
Use one API to record and send your data from your Meteor app to your analytics platforms.

## Installation

`> meteor add okgrow:analytics`

## Configuration

Add various platforms by adding each tool's configuration to your `settings.json` file:

```
{
  "public": {
    "analyticsSettings": {
      // Add your analytics tracking id's here (remove this line before running)
      "Google Analytics" : {"trackingId": "Your tracking ID"},
      "GoSquared"        : {"siteToken": "Your site token (eg. GSN-123456-Y)"},
      "Mixpanel"         : {"token":  "your token", "people": true},
      "KISSmetrics"      : {"apiKey": "your api key"},
      "UserVoice"        : {"apiKey": "your api key"},
      "Sentry"           : {"config": "your config key"},
      "Segment.io"       : {"apiKey": "your api key"},
      "Keen IO"          : {"projectId": "your project id", "writeKey": "your write key"}
    }
  }
}
```

It's important to note that service names and API key-names provided above are specific to the platform. Make sure to use the correct service name and key shown for the plaform you're adding.

### Page views

Compatible with either IronRouter or FlowRouter (even pre-2.0 FlowRouter),
this package will log page views automatically. For FlowRouter, the page is
logged with the follow parameters:

 * `path`: path part of the URL
 * `title`: the page's title, as specified by the route
 * `url`: hostname + path
 * `name`: route name if set, otherwise equivalent to `path`
 * `search`: the URL's query string, if provided. blank otherwise
 * `referrer`: hostname + old path, if coming from a previous route

To manually log a page view: `analytics.page('page name')`

### Log signin/signout

If you have the `accounts` package installed, this package will automatically track when a user logs in and logs out. Logging in will call `identify` on the user and associate their `Meteor.userId` to their previous anonymous activities.

### Event tracking

Add tracking on any event simply by calling the `analytics.track()` function:

```
analytics.track("Bought Ticket", {
  eventName: "Wine Tasting",
  couponValue: 50,
});
```

See the [analytics.js track documentation](https://segment.com/docs/libraries/analytics.js/#track) for a full description of `track()` and all the other functions available in this package.

### Track visitor scrolling

Josh Owens' article, [Google Analytics events, goals, and Meteor.js](http://joshowens.me/google-analytics-events-goals-and-meteor-js/), goes over a great way to capture how far a visitor has scrolled down a page.

### Configuration

> Q: What other analytics platforms are supported?  
A: This package uses the [analytics.js](https://segment.com/docs/libraries/analytics.js/) open source project under the hood which does support many additional platforms. The challenge is using the correct API key-name and any other required options, but these setting can usually be found by looking at the individual integration repos. If you've used other services with the open-source codebase and can confirm the API options please submit a PR to update this example!

#### Browser Policy

If your project uses the [Browser Policy package](https://atmospherejs.com/meteor/browser-policy), we've included the Google Analytics & Mixpanel domains in our browser policy configuration. Any additional services you add will need to be added to your browser policy config as well.

###### example
```
// file: lib/browser-policy.js

BrowserPolicy.content.allowOriginForAll("www.google-analytics.com");
BrowserPolicy.content.allowOriginForAll("cdn.mxpnl.com");
```

If your project doesn't use this package, then don't worry as it will not affect your usage.

### Debugging

When adding your platforms and setting events to track, you'll probably want to keep debug on locally. This will log all the analytics package's activity to the console.  
In the console:  
`> analytics.debug()`

Turn debug off with `analytics.debug(false)`
