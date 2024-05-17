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

const MDN_URL_ROOT = "https://developer.mozilla.org/docs/web/";

function processMdnPath(path, area) {
  if (area === "api") {
    return path.replace(/\//g, ".");
  }

  if (area === "html") {
    if (path.startsWith("Global_attributes/")) {
      return path.substring("Global_attributes/".length) + " global attribute";
    }

    if (path.startsWith("Element/")) {
      const attribute = path.includes("#") ? path.substring(path.indexOf("#") + 1) : null;
      if (attribute) {
        return `<${path.substring("Element/".length, path.indexOf("#"))} ${attribute}> attribute`;
      } else {
        return `<${path.substring("Element/".length)}> element`;
      }
    }

    if (path.toLowerCase().startsWith("attributes/") && path.split("/").length === 3) {
      const [_, attr, value] = path.split("/");
      return `${attr}="${value}" attribute`;
    }
  }

  if (area === "css") {
    if (path.startsWith("color_value/")) {
      return `${path.substring("color_value/".length)} color value`;
    } else if (path.startsWith("gradient/")) {
      return `${path.substring("gradient/".length)}() gradient function`;
    } else if (path.startsWith("::")) {
      return `${path} pseudo-element`;
    } else if (path.startsWith(":")) {
      return `${path} pseudo-class`;
    } else if (path.startsWith("transform-function/")) {
      return `${path.substring("transform-function/".length)}() function`;
    } else {
      return `${path} property`;
    }
  }

  if (area === "javascript") {
    if (path.toLowerCase().startsWith("reference/global_objects/")) {
      const object = path.substring("reference/global_objects/".length);
      if (object.includes("/")) {
        return object.replace(/\//g, ".");
      } else {
        return `${object} global object`;
      }
    }

    if (path.toLowerCase().startsWith("reference/operators/")) {
      return `${path.substring("reference/operators/".length)} operator`;
    }
     
    if (path.toLowerCase().startsWith("reference/statements/")) {
      return `${path.substring("reference/statements/".length)} statement`;
    }
  }

  return path;
}

function processMdnUrl(url) {
  let path = url.substring(MDN_URL_ROOT.length);
  const area = path.split("/")[0].toLowerCase();
  path = path.substring(area.length + 1);
  const title = processMdnPath(path, area);
  return { title, url, area }
}

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
  const mdnUrls = {};
  let hasMdnUrls = false;
  for (const { compat } of bcdKeysData) {
    if (compat.mdn_url) {
      const urlData = processMdnUrl(compat.mdn_url);
      if (!mdnUrls[urlData.area]) {
        mdnUrls[urlData.area] = [];
      }
      hasMdnUrls = true;
      mdnUrls[urlData.area].push(urlData);
    }
  }

  feature.mdnUrls = mdnUrls;
  feature.hasMdnUrls = hasMdnUrls;

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
