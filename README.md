# Quick Switcher++ for Obsidian

[![GitHub release (latest SemVer including pre-releases)](https://img.shields.io/github/v/release/darlal/obsidian-switcher-plus?include_prereleases&sort=semver&style=for-the-badge)](https://github.com/darlal/obsidian-switcher-plus/releases/latest) [![GitHub all releases](https://img.shields.io/github/downloads/darlal/obsidian-switcher-plus/total?style=for-the-badge)](https://github.com/darlal/obsidian-switcher-plus/releases/latest)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/darlal/obsidian-switcher-plus/Create%20and%20publish%20release?logo=github&style=for-the-badge)](https://github.com/darlal/obsidian-switcher-plus/actions)


Find what you're looking for faster, using Quick Switcher++. An [Obsidian.md](https://obsidian.md/) plugin that extends the functionality of the builtin "Quick Switcher".

## Features

* [Navigate to symbols (Headings, Hashtags, Links, Embeddings) in your notes](#symbol-navigation-headings--hashtags-links-embeddings)
  * [Configuration](#symbol-navigation-configuration)
* [Navigate between open editors, and side panels](#navigate-between-open-editors)
  * [Configuration](#editor-navigation-configuration)
* [Global Commands for Hotkeys/Shortcuts](#global-commands-for-hotkeys)

## Demo

**Symbol Navigation:** Launch Switcher++ using a shortcut, filter all files to find the `Format your notes` file, then trigger the symbol command (default `@`) to open the file directly to the `External links` section.

![Symbol Mode gif](https://raw.githubusercontent.com/darlal/obsidian-switcher-plus/master/demo/symbol-mode.gif)

**Editor Navigation:** Launch Switcher++ directly into editor mode using a shortcut, filter the currently open editors to find the `Format your notes` editor and make it active. Then use Switcher++ again to open the `backlinks` side panel.

![Symbol Mode gif](https://raw.githubusercontent.com/darlal/obsidian-switcher-plus/master/demo/editor-mode.gif)

## Symbol Navigation (Headings, Hashtags, Links, Embeddings)

View, filter, and navigate to any symbol (Headings, Hashtags, Links, Embedding) in a file directly from the Quick Switcher.

**For the currently open and focused pane:** symbols can be viewed directly by using the `Open in Symbol Mode` global hotkey (see below).

**For any other file (open or not):** symbols can be viewed by opening Quick Switcher++, typing some characters to filter and/or using the arrow keys to select (highlight) the file of interest. Then, once the file of interest is selected/highlighted, type the `@` (default) character to view the symbols for the file of interest.

![symbol outline preview](https://raw.githubusercontent.com/darlal/obsidian-switcher-plus/master/demo/symbol-outline.png)

### Symbol Navigation Configuration

| Setting                          | Description | Default |
|----------------------------------|-------------|---------|
| Symbol list mode trigger         | Character that will trigger symbol list mode in the switcher. | `@` |
| List symbols as indented outline | **Enabled**: symbols will be displayed in the (line) order they appear in the source text, indented under any preceding heading.<br />**Disabled**: symbols will be grouped by type: Headings, Tags, Links, Embeds. | true |
| Open Symbols in new pane         | **Enabled**: always open a new pane when navigating to Symbols.<br />**Disabled**: navigate in an already open pane (if one exists). | false |

## Navigate between open editors

View, and filter all of the currently open editors, and navigate to any of them from Quick Switcher++ by using the default `edt ` command. Note: Symbol search works in this mode as well, so you can use both modes together e.g. `edt @`. The default builtin Quick Switcher behavior is used when no commands are present.

Editors/views from the side panels can be configured to be displayed in the list as well. For example, you could use this to navigate to the `backlinks`, `file explorer`, `tag pane`, etc.. system views/panes directly from the Quick Switcher.

![editor search preview](https://raw.githubusercontent.com/darlal/obsidian-switcher-plus/master/demo/edt-command.png)

### Editor Navigation Configuration

| Setting                  | Description | Default |
|--------------------------|-------------|---------|
| Editor list mode trigger | Character that will trigger editor list mode in the switcher. | `edt ` |
| Include side panel views | Show the specified view types from the side panels in the switcher. Add one view type per line. Leave empty to never display side panel editors in the switcher. | `backlink`<br />`image`<br />`markdown`<br />`pdf` |

## Global Commands for Hotkeys

The following Global Commands are registered by the plugin, which can be used for global hotkeys/shortcuts.

* `Quick Switcher++: Open`
* `Quick Switcher++: Open in Editor Mode`
* `Quick Switcher++: Open in Symbol Mode`

## Installation

### From Obsidian

From Obsidian v0.9.10, this plugin can be activated from within Obsidian:
- Open Settings > Third-party plugin
- Make sure Safe mode is **off**
- Click Browse community plugins
- Search for "Quick Switcher++"
- Click the "Install" button
- Once installed, close the community plugins window
- Under the "Installed plugins" section, enable Quick Switcher++

### From Github

- Download the [Latest release distribution](https://github.com/darlal/obsidian-switcher-plus/releases)
- Extract the the contents of the distribution zip file to your vault's plugins folder: `<vault>/.obsidian/plugins/`
Note: On MacOs the `.obsidian` folder may be hidden by default.
- Reload Obsidian
- Open Settings, third-party plugins, make sure safe mode is off and enable "Quick Switcher++" from there.

## Change Log

* See the [releases page](https://github.com/darlal/obsidian-switcher-plus/releases) for changes in each release.

## Notes

* This plugin very much experimental at the moment, use it at your own risk. It's only been tested on MacOS, other platforms may have issues.

## Giving Thanks 🙏

If this project has been useful to you, give thanks to support its continued development and maintenance. Any contribution towards a cup of ☕ or 🍺 is greatly appreciated. Thank you!

[![Give Thanks Paypal](https://img.shields.io/badge/Give%20Thanks-Paypal-blue?style=flat&logo=paypal)](https://paypal.me/darla) [![Give Thanks buymeacoffee](https://img.shields.io/badge/Give%20Thanks-Buy%20me%20a%20coffee-%23FFDD00?style=flat&logo=buymeacoffee)](https://www.buymeacoffee.com/darlal)
