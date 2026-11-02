// The regional view: one rollup per region, across every system checked there.
//
// Upptime has no setting for this, so the page is a static file in assets/, which Upptime copies
// onto the site unchanged, and it reads the same history/summary.json the Status page reads.
// A check belongs to a region when its name ends with that region in parentheses, as in
// "API (Europe)". A check with no region in its name, such as Sign-in, runs from GitHub's runner
// rather than from a region, so it is in no rollup.
(function () {
  "use strict";

  var SUMMARY_URL =
    "https://raw.githubusercontent.com/IP-Attorney-Hub/status/master/history/summary.json";
  var REGION_SUFFIX = /^(.*\S)\s*\(([^()]+)\)$/;
  var PERIODS = {
    day: { field: "uptimeDay", label: "24 hours" },
    week: { field: "uptimeWeek", label: "7 days" },
    month: { field: "uptimeMonth", label: "30 days" },
    year: { field: "uptimeYear", label: "1 year" },
  };
  var STATUS_TEXT = { up: "Operational", degraded: "Degraded", down: "Down" };

  // Down when any member is down, degraded when any member is degraded, otherwise up.
  function rollupStatus(statuses) {
    if (statuses.indexOf("down") !== -1) return "down";
    if (statuses.indexOf("degraded") !== -1) return "degraded";
    return "up";
  }

  // Each member's uptime covers the same window, but the summary does not say when its downtime
  // fell. Adding the members' downtime together counts an outage that two systems shared twice,
  // so the figure can understate the region's uptime and never overstates it.
  function rollupUptime(uptimes) {
    var downtime = 0;
    for (var i = 0; i < uptimes.length; i++) {
      var percent = parseFloat(uptimes[i]);
      if (isNaN(percent)) return null;
      downtime += 100 - percent;
    }
    return Math.max(0, 100 - downtime);
  }

  function groupByRegion(sites) {
    var regions = [];
    var byName = {};
    sites.forEach(function (site) {
      var match = REGION_SUFFIX.exec(site.name || "");
      if (!match) return;
      var regionName = match[2];
      if (!byName[regionName]) {
        byName[regionName] = { name: regionName, members: [] };
        regions.push(byName[regionName]);
      }
      byName[regionName].members.push({ system: match[1], site: site });
    });
    return regions;
  }

  function summarize(region, period) {
    var field = PERIODS[period].field;
    var uptime = rollupUptime(
      region.members.map(function (member) {
        return member.site[field];
      })
    );
    return {
      name: region.name,
      status: rollupStatus(
        region.members.map(function (member) {
          return member.site.status;
        })
      ),
      uptime: uptime === null ? null : uptime.toFixed(2) + "%",
      members: region.members.map(function (member) {
        return {
          system: member.system,
          slug: member.site.slug,
          status: member.site.status,
          uptime: member.site[field],
        };
      }),
    };
  }

  var api = {
    rollupStatus: rollupStatus,
    rollupUptime: rollupUptime,
    groupByRegion: groupByRegion,
    summarize: summarize,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderRegion(summary) {
    var article = element("article", summary.status);
    var heading = element("h4", "f");
    heading.appendChild(element("span", null, summary.name));
    heading.appendChild(
      element("span", "tag " + summary.status, STATUS_TEXT[summary.status] || summary.status)
    );
    article.appendChild(heading);
    article.appendChild(
      element(
        "div",
        null,
        summary.uptime === null ? "Uptime unavailable" : "Uptime " + summary.uptime
      )
    );

    var list = element("ul", "members");
    summary.members.forEach(function (member) {
      var item = element("li", "f");
      var link = element("a", null, member.system);
      link.href = "/history/" + encodeURIComponent(member.slug);
      item.appendChild(link);
      item.appendChild(
        element(
          "span",
          "member-status " + member.status,
          (STATUS_TEXT[member.status] || member.status) + " · " + member.uptime
        )
      );
      list.appendChild(item);
    });
    article.appendChild(list);
    return article;
  }

  function start() {
    var section = document.getElementById("regions");
    var form = document.getElementById("period");
    var regions = null;

    function render() {
      var period = form.elements.d.value;
      section.textContent = "";
      regions.forEach(function (region) {
        section.appendChild(renderRegion(summarize(region, period)));
      });
    }

    form.addEventListener("change", function () {
      if (regions) render();
    });

    fetch(SUMMARY_URL, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error(response.statusText);
        return response.json();
      })
      .then(function (sites) {
        regions = groupByRegion(sites);
        render();
      })
      .catch(function () {
        section.textContent = "";
        section.appendChild(
          element("p", null, "The current status could not be loaded. Try again in a minute.")
        );
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
