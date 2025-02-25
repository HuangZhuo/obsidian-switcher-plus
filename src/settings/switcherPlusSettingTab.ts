import { SettingsTabSection } from './settingsTabSection';
import { StarredSettingsTabSection } from './starredSettingsTabSection';
import { CommandListSettingsTabSection } from './commandListSettingsTabSection';
import { RelatedItemsSettingsTabSection } from './relatedItemsSettingsTabSection';
import { GeneralSettingsTabSection } from './generalSettingsTabSection';
import { WorkspaceSettingsTabSection } from './workspaceSettingsTabSection';
import { EditorSettingsTabSection } from './editorSettingsTabSection';
import { HeadingsSettingsTabSection } from './headingsSettingsTabSection';
import { SymbolSettingsTabSection } from './symbolSettingsTabSection';
import { SwitcherPlusSettings } from './switcherPlusSettings';
import { App, PluginSettingTab } from 'obsidian';
import type SwitcherPlusPlugin from '../main';

type ConstructableSettingsTabSection = {
  new (
    app: App,
    mainSettingsTab: PluginSettingTab,
    config: SwitcherPlusSettings,
  ): SettingsTabSection;
};

export class SwitcherPlusSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: SwitcherPlusPlugin,
    private config: SwitcherPlusSettings,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const tabSections = [
      GeneralSettingsTabSection,
      SymbolSettingsTabSection,
      HeadingsSettingsTabSection,
      EditorSettingsTabSection,
      RelatedItemsSettingsTabSection,
      StarredSettingsTabSection,
      CommandListSettingsTabSection,
      WorkspaceSettingsTabSection,
    ];

    containerEl.empty();
    containerEl.createEl('h2', { text: 'Quick Switcher++ Settings' });

    tabSections.forEach((tabSectionClass) => {
      this.displayTabSection(tabSectionClass);
    });
  }

  displayTabSection(tabSectionClass: ConstructableSettingsTabSection): void {
    const { app, config, containerEl } = this;
    const tabSection = new tabSectionClass(app, this, config);
    tabSection.display(containerEl);
  }
}
