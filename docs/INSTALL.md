# Installation

## Option A - Install by manifest (end users)

1. In Foundry, open **Add-on Modules → Install Module**.
2. Paste the manifest URL:
   ```
   https://raw.githubusercontent.com/phillipsOG/Dynamic-Spectator/main/module.json
   ```
3. Click **Install**.
4. In your world, open **Manage Modules**, enable **Dynamic Spectator**, and
   (recommended) **lib-wrapper**. Save.

## Option B - Install a release zip

1. Download `module.zip` from the
   [latest release](https://github.com/phillipsOG/Dynamic-Spectator/releases/latest).
2. Extract into your Foundry data folder under `Data/modules/dynamic-spectator`
   so that `Data/modules/dynamic-spectator/module.json` exists.
3. Restart Foundry, then enable the module.

## Option C - From source (developers)

```bash
git clone https://github.com/phillipsOG/Dynamic-Spectator.git
cd Dynamic-Spectator
npm install
npm run build
```

Then either copy the folder into `Data/modules/dynamic-spectator`, or link it:

```bash
# Windows (PowerShell/Git Bash) - junction, no admin needed:
npm run link -- "C:/Users/<you>/AppData/Local/FoundryVTT/Data"

# macOS/Linux:
npm run link -- "$HOME/.local/share/FoundryVTT/Data"
```

`npm run link` symlinks (or copies, if symlinks are unavailable) the built module
into your Foundry `modules` directory. Rebuild with `npm run build` (or keep
`npm run watch` running) and reload Foundry to pick up changes.

## Finding your Foundry data path

Foundry shows it on the **Setup** screen under **Configuration** →
"User Data Path". Common defaults:

| OS | Path |
| --- | --- |
| Windows | `C:\Users\<you>\AppData\Local\FoundryVTT\Data` |
| macOS | `~/Library/Application Support/FoundryVTT/Data` |
| Linux | `~/.local/share/FoundryVTT/Data` |

## Requirements

- Foundry VTT **v12+** (verified on **v13**).
- **lib-wrapper** - recommended, not required. Without it the module uses a
  manual, fully-reversible vision patch.

## Uninstall

Disable the module in **Manage Modules**, or delete
`Data/modules/dynamic-spectator`. The module modifies no core files and leaves no
persistent world data beyond the settings and any per-token opt-out flags you set
(cleared automatically if the module is removed).
