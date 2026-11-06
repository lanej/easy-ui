from pathlib import Path
p = Path('scripts/check-investigation-workbench.mjs')
s = p.read_text()
a = '''      assert.equal(
        (await sharedLedger
          .locator('[data-connection-id="unassigned-report-link"]')
          .count()) > 0,
        true,
      );'''
b = '''      // Showing the mobile event panel remeasures SVG endpoints asynchronously.
      // Wait for that exact connection, rather than sampling a transient count.
      const unassignedConnection = sharedLedger.locator(
        '[data-connection-id="unassigned-report-link"]',
      );
      try {
        await unassignedConnection.first().waitFor({ state: "attached" });
      } catch (error) {
        await capture(`missing-connection-${theme}-${width}.png`, theme);
        throw error;
      }
      assert.ok((await unassignedConnection.count()) > 0);'''
assert s.count(a) == 1
p.write_text(s.replace(a,b))
