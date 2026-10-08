/*! MarketplacePH storefront widget. Usage:
 *  <div data-mph-store="your-store-slug" data-mph-mode="button|widget"></div>
 *  <script async src="https://www.marketplaceph.com/embed.js"></script>
 * The script only reads public store data and renders plain links. No cookies, no tracking.
 */
(function () {
  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : "https://www.marketplaceph.com";
  var NAVY = "#06308f", ORANGE = "#f97316";

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text) n.textContent = text;
    return n;
  }
  function peso(n) { return "₱" + Number(n).toLocaleString("en-PH", { maximumFractionDigits: 2 }); }
  function price(i) {
    if (i.price_type === "fixed") return peso(i.price_min) + "/" + i.unit;
    if (i.price_type === "range") return peso(i.price_min) + " – " + peso(i.price_max);
    return "Message for price";
  }
  function button(url) {
    var a = el("a", "display:inline-flex;align-items:center;gap:8px;background:" + ORANGE + ";color:" + NAVY + ";font:700 16px/1 system-ui,sans-serif;padding:14px 20px;border-radius:12px;text-decoration:none;min-height:44px");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    a.textContent = "Shop on MarketplacePH";
    return a;
  }

  document.querySelectorAll("[data-mph-store]").forEach(function (host) {
    if (host.getAttribute("data-mph-ready")) return;
    host.setAttribute("data-mph-ready", "1");
    var slug = host.getAttribute("data-mph-store");
    var mode = host.getAttribute("data-mph-mode") || "widget";
    fetch(origin + "/api/embed/" + encodeURIComponent(slug))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        if (mode === "button") { host.appendChild(button(d.store.url)); return; }
        var box = el("div", "font-family:system-ui,sans-serif;border:1px solid #dbe3f0;border-radius:16px;padding:16px;max-width:760px;background:#fff;color:#0f172a");
        box.appendChild(el("p", "margin:0 0 12px;font-weight:800;font-size:18px", d.store.name));
        var grid = el("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px");
        d.items.slice(0, 6).forEach(function (i) {
          var a = el("a", "display:block;text-decoration:none;color:inherit");
          a.href = i.url; a.target = "_blank"; a.rel = "noopener";
          var img = el("img", "width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;background:#f1f5fb");
          img.src = i.image; img.alt = i.title; img.loading = "lazy"; img.width = 300; img.height = 300;
          a.appendChild(img);
          a.appendChild(el("p", "margin:6px 0 0;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", i.title));
          a.appendChild(el("p", "margin:0;font-size:13px;color:" + NAVY + ";font-weight:800", price(i)));
          grid.appendChild(a);
        });
        box.appendChild(grid);
        var foot = el("div", "margin-top:14px");
        foot.appendChild(button(d.store.url));
        box.appendChild(foot);
        host.appendChild(box);
      })
      .catch(function () {});
  });
})();
