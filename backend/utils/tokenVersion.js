function getTokenVersion(account) {
  const version = account.tokenVersion ?? 0;
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error('Invalid account token version');
  }
  return version;
}

function tokenVersionMatches(tokenVersion, accountVersion) {
  const issuedVersion = tokenVersion === undefined ? 0 : tokenVersion;
  return Number.isSafeInteger(issuedVersion)
    && issuedVersion >= 0
    && issuedVersion === accountVersion;
}

module.exports = { getTokenVersion, tokenVersionMatches };
