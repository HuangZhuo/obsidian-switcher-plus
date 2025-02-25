import { getInternalPluginById } from 'src/utils';
import { InputInfo } from 'src/switcherPlus';
import { AnySuggestion, Mode, CommandSuggestion, SuggestionType } from 'src/types';
import { Handler } from './handler';
import {
  InstalledPlugin,
  SearchResult,
  sortSearchResults,
  WorkspaceLeaf,
  fuzzySearch,
  CommandPalettePluginInstance,
  Command,
  App,
} from 'obsidian';

export const COMMAND_PALETTE_PLUGIN_ID = 'command-palette';
export type CommandInfo = { cmd: Command; isPinned: boolean; isRecentOpen: boolean };

const recentlyUsedCommandIds: string[] = [];

export class CommandHandler extends Handler<CommandSuggestion> {
  get commandString(): string {
    return this.settings?.commandListCommand;
  }

  validateCommand(
    inputInfo: InputInfo,
    index: number,
    filterText: string,
    _activeSuggestion: AnySuggestion,
    _activeLeaf: WorkspaceLeaf,
  ): void {
    inputInfo.mode = Mode.CommandList;

    const commandCmd = inputInfo.parsedCommand(Mode.CommandList);
    commandCmd.index = index;
    commandCmd.parsedInput = filterText;
    commandCmd.isValidated = true;
  }

  getSuggestions(inputInfo: InputInfo): CommandSuggestion[] {
    const suggestions: CommandSuggestion[] = [];

    if (inputInfo) {
      inputInfo.buildSearchQuery();
      const { hasSearchTerm, prepQuery } = inputInfo.searchQuery;
      const itemsInfo = this.getItems(hasSearchTerm, recentlyUsedCommandIds);

      itemsInfo.forEach(({ isPinned, isRecentOpen, cmd }) => {
        let shouldPush = true;
        let match: SearchResult = null;

        if (hasSearchTerm) {
          match = fuzzySearch(prepQuery, cmd.name);
          shouldPush = !!match;
        }

        if (shouldPush) {
          suggestions.push({
            type: SuggestionType.CommandList,
            item: cmd,
            isPinned,
            isRecentOpen,
            match,
          });
        }
      });

      if (hasSearchTerm) {
        sortSearchResults(suggestions);
      }
    }

    return suggestions;
  }

  renderSuggestion(sugg: CommandSuggestion, parentEl: HTMLElement): void {
    if (sugg) {
      const { item, match, isPinned, isRecentOpen } = sugg;
      this.addClassesToSuggestionContainer(parentEl, ['qsp-suggestion-command']);
      this.renderContent(parentEl, item.name, match);

      const flairContainerEl = this.createFlairContainer(parentEl);
      this.renderHotkeyForCommand(item.id, this.app, flairContainerEl);

      if (item.icon) {
        this.renderIndicator(flairContainerEl, [], item.icon);
      }

      if (isPinned) {
        this.renderIndicator(flairContainerEl, [], 'filled-pin');
      } else if (isRecentOpen) {
        this.renderOptionalIndicators(parentEl, sugg, flairContainerEl);
      }
    }
  }

  renderHotkeyForCommand(id: string, app: App, flairContainerEl: HTMLElement): void {
    try {
      const hotkeyStr = app.hotkeyManager.printHotkeyForCommand(id);
      if (hotkeyStr?.length) {
        flairContainerEl.createEl('kbd', {
          cls: 'suggestion-hotkey',
          text: hotkeyStr,
        });
      }
    } catch (err) {
      console.log('Switcher++: error rendering hotkey for command id: ', id, err);
    }
  }

  onChooseSuggestion(sugg: CommandSuggestion): void {
    if (sugg) {
      const { item } = sugg;
      this.app.commands.executeCommandById(item.id);
      this.saveUsageToList(item.id, recentlyUsedCommandIds);
    }
  }

  saveUsageToList(commandId: string, recentCommandIds: string[]): void {
    if (recentCommandIds) {
      const oldIndex = recentCommandIds.indexOf(commandId);
      if (oldIndex > -1) {
        recentCommandIds.splice(oldIndex, 1);
      }

      recentCommandIds.unshift(commandId);
      recentCommandIds.splice(25);
    }
  }

  getItems(includeAllCommands: boolean, recentCommandIds: string[]): CommandInfo[] {
    const { app } = this;
    const items = includeAllCommands
      ? this.getAllCommandsList(app, recentCommandIds)
      : this.getInitialCommandList(app, recentCommandIds);

    return items ?? [];
  }

  getAllCommandsList(app: App, recentCommandIds: string[]): CommandInfo[] {
    const pinnedIdsSet = this.getPinnedCommandIds();
    const recentIdsSet = new Set(recentCommandIds);

    return app.commands
      .listCommands()
      ?.sort((a, b) => a.name.localeCompare(b.name))
      .map((cmd) => {
        return {
          isPinned: pinnedIdsSet.has(cmd.id),
          isRecentOpen: recentIdsSet.has(cmd.id),
          cmd,
        };
      });
  }

  getInitialCommandList(app: App, recentCommandIds: string[]): CommandInfo[] {
    const commands: CommandInfo[] = [];

    const findAndAdd = (id: string, isPinned: boolean, isRecentOpen: boolean) => {
      const cmd = app.commands.findCommand(id);
      if (cmd) {
        commands.push({ isPinned, isRecentOpen, cmd });
      }
    };

    const pinnedCommandIds = this.getPinnedCommandIds();
    pinnedCommandIds.forEach((id) => findAndAdd(id, true, false));
    commands.sort((a, b) => a.cmd.name.localeCompare(b.cmd.name));

    // remove any pinned commands from the recently used list so they don't show up in
    // both pinned and recent sections
    recentCommandIds
      ?.filter((v) => !pinnedCommandIds.has(v))
      .forEach((id) => findAndAdd(id, false, true));

    // if there are no pinned, and no recent items, show the whole list
    return commands.length ? commands : this.getAllCommandsList(app, recentCommandIds);
  }

  getPinnedCommandIds(): Set<string> {
    let pinnedCommandIds: Set<string>;

    if (
      this.isCommandPalettePluginEnabled() &&
      this.getCommandPalettePluginInstance()?.options.pinned?.length
    ) {
      pinnedCommandIds = new Set(this.getCommandPalettePluginInstance().options.pinned);
    }

    return pinnedCommandIds ?? new Set<string>();
  }

  private isCommandPalettePluginEnabled(): boolean {
    const plugin = this.getCommandPalettePlugin();
    return plugin?.enabled;
  }

  private getCommandPalettePlugin(): InstalledPlugin {
    return getInternalPluginById(this.app, COMMAND_PALETTE_PLUGIN_ID);
  }

  private getCommandPalettePluginInstance(): CommandPalettePluginInstance {
    const commandPalettePlugin = this.getCommandPalettePlugin();
    return commandPalettePlugin?.instance as CommandPalettePluginInstance;
  }
}
