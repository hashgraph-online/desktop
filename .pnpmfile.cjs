module.exports = {
  hooks: {
    readPackage(pkg) {
      // Fix for circular dependencies in noble libraries
      if (pkg.name === '@noble/curves' || pkg.name === '@noble/hashes') {
        // Force specific versions to avoid circular deps
        if (pkg.dependencies) {
          // Remove any self-references
          delete pkg.dependencies[pkg.name];
        }
      }
      
      // Fix for electron dependencies
      if (pkg.name === 'electron' || pkg.name.startsWith('@electron')) {
        // Ensure electron deps are hoisted properly
        pkg.publishConfig = pkg.publishConfig || {};
        pkg.publishConfig.hoist = true;
      }
      
      return pkg;
    }
  }
};