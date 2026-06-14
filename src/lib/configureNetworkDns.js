const dns = require("dns");
const http = require("http");
const https = require("https");

/** gRPC (Firestore) için c-ares DNS; setServers ile birlikte kullanılır */
process.env.GRPC_DNS_RESOLVER = process.env.GRPC_DNS_RESOLVER || "ares";

/**
 * Bazı sunucu/container ortamlarında systemd-resolved stub (127.0.0.53) çalışmaz;
 * Node https ve Google SDK istekleri EAI_AGAIN verir.
 */
function configureNetworkDns() {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);

  function customLookup(hostname, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }

    dns.resolve4(hostname, (err, addresses) => {
      if (err) {
        callback(err);
        return;
      }

      const address = addresses[0];
      const family = 4;

      if (options?.all) {
        callback(
          null,
          addresses.map((addr) => ({ address: addr, family: 4 }))
        );
        return;
      }

      callback(null, address, family);
    });
  }

  http.globalAgent = new http.Agent({ lookup: customLookup, keepAlive: true });
  https.globalAgent = new https.Agent({ lookup: customLookup, keepAlive: true });

  return customLookup;
}

module.exports = { configureNetworkDns };
