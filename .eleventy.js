const { EleventyHtmlBasePlugin } = require("@11ty/eleventy");

const BROWSERS = [
  { id: "chrome", name: "Chrome" },
  { id: "chrome_android", name: "Chrome on Android" },
  { id: "edge", name: "Edge" },
  { id: "firefox", name: "Firefox" },
  { id: "firefox_android", name: "Firefox on Android" },
  { id: "safari", name: "Safari" },
  { id: "safari_ios", name: "Safari on iOS" },
];

// Add more data to a feature's object, based on what our templates need.
function augmentFeatureData(id, feature, bcd) {
  // Add the id.
  feature.id = id;

  // Make the spec always an array.
  if (!feature.spec) {
    feature.spec = [];
  } else if (!Array.isArray(feature.spec)) {
    feature.spec = [feature.spec];
  }

  const bcdKeysData = (feature.compat_features || []).map(key => {
    // Find the BCD entry for this key.
    const keyParts = key.split(".");
    let data = bcd;
    for (const part of keyParts) {
      data = data[part];
    }

    return data && data.__compat ? { key, compat: data.__compat } : null;
  }).filter(data => !!data);

  // Add MDN doc links, if any.
  const mdnUrls = [];
  for (const { compat } of bcdKeysData) {
    if (compat.mdn_url) {
      mdnUrls.push(compat.mdn_url);
    }
  }

  feature.mdnUrls = mdnUrls;

  // Add the BCD data to the feature.
  feature.bcdData = bcdKeysData;
  
  // Add impl_url links, if any, per browser.
  const browserImplUrls = Object.values(BROWSERS).reduce((acc, browser) => {
    acc[browser.id] = [];
    return acc;
  }, {});

  for (const { compat } of bcdKeysData) {
    for (const browser of BROWSERS) {
      const browserSupport = compat.support[browser.id];
      if (!browserSupport.version_added && browserSupport.impl_url) {
        browserImplUrls[browser.id] = [...new Set([...browserImplUrls[browser.id], browserSupport.impl_url])];
      }
    }
  }

  feature.implUrls = browserImplUrls;
}

async function getDeps() {
  const { default: features } = await import("web-features");
  const { default: bcd } = await import("@mdn/browser-compat-data", {
    assert: { type: "json" },
  });

  return { features, bcd };
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.addPassthroughCopy("site/assets");

  // FIXME: Ideally, web-features would have this data.
  eleventyConfig.addGlobalData("browsers", async () => {
    return BROWSERS;
  });

  eleventyConfig.addGlobalData("allFeatures", async () => {
    const { features, bcd } = await getDeps();

    const all = [];

    for (const id in features) {
      const feature = features[id];
      augmentFeatureData(id, feature, bcd);
      all.push(feature);
    }

    return all;
  });

  eleventyConfig.addGlobalData("baselineFeatures", async () => {
    const { features, bcd } = await getDeps();

    const baseline = [];

    for (const id in features) {
      const feature = features[id];

      // Baseline features only.
      if (feature.status.baseline === "high") {
        augmentFeatureData(id, feature, bcd);
        baseline.push(feature);
      }
    }

    return baseline;
  });

  eleventyConfig.addGlobalData("nonBaselineFeatures", async () => {
    const { features, bcd } = await getDeps();

    const nonBaseline = [];

    for (const id in features) {
      const feature = features[id];

      // Non-baseline features only.
      if (!feature.status.baseline) {
        augmentFeatureData(id, feature, bcd);
        nonBaseline.push(feature);
      }
    }

    return nonBaseline;
  });

  eleventyConfig.addGlobalData("recentBaselineFeatures", async () => {
    const { features, bcd } = await getDeps();

    const recentBaseline = [];

    for (const id in features) {
      const feature = features[id];
      augmentFeatureData(id, feature, bcd);

      // Only baseline low.
      if (feature.status.baseline === "low") {
        recentBaseline.push(feature);
      }
    }

    return recentBaseline.sort((a, b) => {
      // Sort by baseline_low_date, descending, so the most recent is first.
      return new Date(b.status.baseline_low_date) - new Date(a.status.baseline_low_date);
    });
  });

  eleventyConfig.addGlobalData("missingOneBrowserFeatures", async () => {
    const { features, bcd } = await getDeps();

    const missingOne = [];

    for (const id in features) {
      const feature = features[id];
      augmentFeatureData(id, feature, bcd);

      // Only non-baseline features.
      if (!feature.status.baseline) {
        // And, out of those, only those that are missing support in just one browser (engine).
        const noSupport = [];
        for (const { id: browserId } of BROWSERS) {
          if (!feature.status.support[browserId]) {
            noSupport.push(browserId);
          }
        }

        if (noSupport.length === 1) {
          missingOne.push(feature);
        }

        if (noSupport.length === 2) {
          // If one of the two values is a substring of the other, then these are the same engine.
          const [first, second] = noSupport;
          if (first.includes(second) || second.includes(first)) {
            missingOne.push(feature);
          }
        }
      }
    }

    return missingOne;
  });

  return {
    dir: {
      input: "site",
      output: "docs",
    },
    pathPrefix: "/web-features-explorer/",
  };
};
