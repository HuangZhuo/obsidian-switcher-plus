import { StandardExHandler } from './standardExHandler';
import { EditorHandler } from './editorHandler';
import {
  HeadingCache,
  PreparedQuery,
  SearchResult,
  TFile,
  TAbstractFile,
  sortSearchResults,
  WorkspaceLeaf,
  TFolder,
} from 'obsidian';
import { InputInfo } from 'src/switcherPlus';
import {
  Mode,
  HeadingSuggestion,
  FileSuggestion,
  AliasSuggestion,
  UnresolvedSuggestion,
  HeadingIndicators,
  AnySuggestion,
  SuggestionType,
  MatchType,
  SearchResultWithFallback,
  EditorSuggestion,
} from 'src/types';
import { isTFile, FrontMatterParser, matcherFnForRegExList } from 'src/utils';
import { Handler } from './handler';

type SupportedSuggestionTypes =
  | HeadingSuggestion
  | FileSuggestion
  | AliasSuggestion
  | UnresolvedSuggestion
  | EditorSuggestion;

export class HeadingsHandler extends Handler<SupportedSuggestionTypes> {
  override get commandString(): string {
    return this.settings?.headingsListCommand;
  }

  validateCommand(
    inputInfo: InputInfo,
    index: number,
    filterText: string,
    _activeSuggestion: AnySuggestion,
    _activeLeaf: WorkspaceLeaf,
  ): void {
    inputInfo.mode = Mode.HeadingsList;

    const headingsCmd = inputInfo.parsedCommand(Mode.HeadingsList);
    headingsCmd.index = index;
    headingsCmd.parsedInput = filterText;
    headingsCmd.isValidated = true;
  }

  onChooseSuggestion(sugg: HeadingSuggestion, evt: MouseEvent | KeyboardEvent): void {
    if (sugg) {
      const {
        start: { line, col },
        end: endLoc,
      } = sugg.item.position;

      // state information to highlight the target heading
      const eState = {
        active: true,
        focus: true,
        startLoc: { line, col },
        endLoc,
        line,
        cursor: {
          from: { line, ch: col },
          to: { line, ch: col },
        },
      };

      this.navigateToLeafOrOpenFile(
        evt,
        sugg.file,
        'Unable to navigate to heading for file.',
        { active: true, eState },
      );
    }
  }

  renderSuggestion(sugg: HeadingSuggestion, parentEl: HTMLElement): void {
    if (sugg) {
      const { item } = sugg;

      this.addClassesToSuggestionContainer(parentEl, [
        'qsp-suggestion-headings',
        `qsp-headings-l${item.level}`,
      ]);

      const contentEl = this.renderContent(parentEl, item.heading, sugg.match);
      this.renderPath(contentEl, sugg.file);

      // render the flair icons
      const flairContainerEl = this.createFlairContainer(parentEl);
      this.renderOptionalIndicators(parentEl, sugg, flairContainerEl);
      this.renderIndicator(
        flairContainerEl,
        ['qsp-headings-indicator'],
        null,
        HeadingIndicators[item.level],
      );

      if (sugg.downranked) {
        parentEl.addClass('mod-downranked');
      }
    }
  }

  getSuggestions(inputInfo: InputInfo): SupportedSuggestionTypes[] {
    let suggestions: SupportedSuggestionTypes[] = [];

    if (inputInfo) {
      inputInfo.buildSearchQuery();
      const { hasSearchTerm } = inputInfo.searchQuery;

      if (hasSearchTerm) {
        const { limit } = this.settings;
        suggestions = this.getAllFilesSuggestions(inputInfo);
        sortSearchResults(suggestions);

        if (suggestions.length > 0 && limit > 0) {
          suggestions = suggestions.slice(0, limit);
        }
      } else {
        suggestions = this.getInitialSuggestionList(inputInfo);
      }
    }

    return suggestions;
  }

  getAllFilesSuggestions(inputInfo: InputInfo): SupportedSuggestionTypes[] {
    const suggestions: SupportedSuggestionTypes[] = [];
    const { prepQuery } = inputInfo.searchQuery;
    const {
      app: { vault },
      settings: { strictHeadingsOnly, showExistingOnly, excludeFolders },
    } = this;

    const isExcludedFolder = matcherFnForRegExList(excludeFolders);
    let nodes: TAbstractFile[] = [vault.getRoot()];

    while (nodes.length > 0) {
      const node = nodes.pop();

      if (isTFile(node)) {
        this.addSuggestionsFromFile(inputInfo, suggestions, node, prepQuery);
      } else if (!isExcludedFolder(node.path)) {
        nodes = nodes.concat((node as TFolder).children);
      }
    }

    if (!strictHeadingsOnly && !showExistingOnly) {
      this.addUnresolvedSuggestions(suggestions as UnresolvedSuggestion[], prepQuery);
    }

    return suggestions;
  }

  addSuggestionsFromFile(
    inputInfo: InputInfo,
    suggestions: SupportedSuggestionTypes[],
    file: TFile,
    prepQuery: PreparedQuery,
  ): void {
    const {
      searchAllHeadings,
      strictHeadingsOnly,
      shouldSearchFilenames,
      shouldShowAlias,
    } = this.settings;

    if (this.shouldIncludeFile(file)) {
      const isH1Matched = this.addHeadingSuggestions(
        inputInfo,
        suggestions as HeadingSuggestion[],
        prepQuery,
        file,
        searchAllHeadings,
      );

      if (!strictHeadingsOnly) {
        if (shouldSearchFilenames || !isH1Matched) {
          // if strict is disabled and filename search is enabled or there
          // isn't an H1 match, then do a fallback search against the filename, then path
          this.addFileSuggestions(
            inputInfo,
            suggestions as FileSuggestion[],
            prepQuery,
            file,
          );
        }

        if (shouldShowAlias) {
          this.addAliasSuggestions(
            inputInfo,
            suggestions as AliasSuggestion[],
            prepQuery,
            file,
          );
        }
      }
    }
  }

  downrankScoreIfIgnored<
    T extends Exclude<SupportedSuggestionTypes, UnresolvedSuggestion | EditorSuggestion>,
  >(sugg: T): T {
    if (this.app.metadataCache.isUserIgnored(sugg?.file?.path)) {
      sugg.downranked = true;

      if (sugg.match) {
        sugg.match.score -= 10;
      }
    }

    return sugg;
  }

  shouldIncludeFile(file: TAbstractFile): boolean {
    let retVal = false;
    const {
      settings: {
        excludeObsidianIgnoredFiles,
        builtInSystemOptions: { showAttachments, showAllFileTypes },
      },
      app: { viewRegistry, metadataCache },
    } = this;

    if (isTFile(file)) {
      const { extension } = file;

      if (!metadataCache.isUserIgnored(file.path) || !excludeObsidianIgnoredFiles) {
        retVal = viewRegistry.isExtensionRegistered(extension)
          ? showAttachments || extension === 'md'
          : showAllFileTypes;
      }
    }

    return retVal;
  }

  private addAliasSuggestions(
    inputInfo: InputInfo,
    suggestions: AliasSuggestion[],
    prepQuery: PreparedQuery,
    file: TFile,
  ): void {
    const { metadataCache } = this.app;
    const frontMatter = metadataCache.getFileCache(file)?.frontmatter;

    if (frontMatter) {
      const aliases = FrontMatterParser.getAliases(frontMatter);
      let i = aliases.length;

      // create suggestions where there is a match with an alias
      while (i--) {
        const alias = aliases[i];
        const { match } = this.fuzzySearchWithFallback(prepQuery, alias);

        if (match) {
          suggestions.push(this.createAliasSuggestion(inputInfo, alias, file, match));
        }
      }
    }
  }

  private addFileSuggestions(
    inputInfo: InputInfo,
    suggestions: FileSuggestion[],
    prepQuery: PreparedQuery,
    file: TFile,
  ): void {
    const { match, matchType, matchText } = this.fuzzySearchWithFallback(
      prepQuery,
      null,
      file,
    );

    if (match) {
      suggestions.push(
        this.createFileSuggestion(inputInfo, file, match, matchType, matchText),
      );
    }
  }

  private addHeadingSuggestions(
    inputInfo: InputInfo,
    suggestions: HeadingSuggestion[],
    prepQuery: PreparedQuery,
    file: TFile,
    allHeadings: boolean,
  ): boolean {
    const { metadataCache } = this.app;
    const headingList = metadataCache.getFileCache(file)?.headings ?? [];
    let h1: HeadingCache = null;
    let isH1Matched = false;
    let i = headingList.length;

    while (i--) {
      const heading = headingList[i];
      let isMatched = false;

      if (allHeadings) {
        isMatched = this.matchAndPushHeading(
          inputInfo,
          suggestions,
          prepQuery,
          file,
          heading,
        );
      }

      if (heading.level === 1) {
        const { line } = heading.position.start;

        if (h1 === null || line < h1.position.start.line) {
          h1 = heading;
          isH1Matched = isMatched;
        }
      }
    }

    if (!allHeadings && h1) {
      isH1Matched = this.matchAndPushHeading(inputInfo, suggestions, prepQuery, file, h1);
    }

    return isH1Matched;
  }

  private matchAndPushHeading(
    inputInfo: InputInfo,
    suggestions: HeadingSuggestion[],
    prepQuery: PreparedQuery,
    file: TFile,
    heading: HeadingCache,
  ): boolean {
    const { match } = this.fuzzySearchWithFallback(prepQuery, heading.heading);

    if (match) {
      suggestions.push(this.createHeadingSuggestion(inputInfo, heading, file, match));
    }

    return !!match;
  }

  private addUnresolvedSuggestions(
    suggestions: UnresolvedSuggestion[],
    prepQuery: PreparedQuery,
  ): void {
    const { unresolvedLinks } = this.app.metadataCache;

    const unresolvedSet = new Set<string>();
    const sources = Object.keys(unresolvedLinks);
    let i = sources.length;

    // create a distinct list of unresolved links
    while (i--) {
      // each source has an object with keys that represent the list of unresolved links
      // for that source file
      const sourcePath = sources[i];
      const links = Object.keys(unresolvedLinks[sourcePath]);
      let j = links.length;

      while (j--) {
        // unresolved links can be duplicates, use a Set to get a distinct list
        unresolvedSet.add(links[j]);
      }
    }

    const unresolvedList = Array.from(unresolvedSet);
    i = unresolvedList.length;

    // create suggestions where there is a match with an unresolved link
    while (i--) {
      const unresolved = unresolvedList[i];
      const result = this.fuzzySearchWithFallback(prepQuery, unresolved);

      if (result.matchType !== MatchType.None) {
        suggestions.push(
          StandardExHandler.createUnresolvedSuggestion(unresolved, result),
        );
      }
    }
  }

  private createAliasSuggestion(
    inputInfo: InputInfo,
    alias: string,
    file: TFile,
    match: SearchResult,
  ): AliasSuggestion {
    const sugg: AliasSuggestion = {
      alias,
      file,
      ...this.createSearchMatch(match, MatchType.Primary, alias),
      type: SuggestionType.Alias,
    };

    Handler.updateWorkspaceEnvListStatus(inputInfo.currentWorkspaceEnvList, sugg);
    return this.downrankScoreIfIgnored(sugg);
  }

  private createFileSuggestion(
    inputInfo: InputInfo,
    file: TFile,
    match: SearchResult,
    matchType = MatchType.None,
    matchText: string = null,
  ): FileSuggestion {
    const sugg: FileSuggestion = {
      file,
      match,
      matchType,
      matchText,
      type: SuggestionType.File,
    };

    Handler.updateWorkspaceEnvListStatus(inputInfo.currentWorkspaceEnvList, sugg);
    return this.downrankScoreIfIgnored(sugg);
  }

  private createHeadingSuggestion(
    inputInfo: InputInfo,
    item: HeadingCache,
    file: TFile,
    match: SearchResult,
  ): HeadingSuggestion {
    const sugg: HeadingSuggestion = {
      item,
      file,
      ...this.createSearchMatch(match, MatchType.Primary, item.heading),
      type: SuggestionType.HeadingsList,
    };

    Handler.updateWorkspaceEnvListStatus(inputInfo.currentWorkspaceEnvList, sugg);
    return this.downrankScoreIfIgnored(sugg);
  }

  private createSearchMatch(
    match: SearchResult,
    type: MatchType,
    text: string,
  ): SearchResultWithFallback {
    let matchType = MatchType.None;
    let matchText = null;

    if (match) {
      matchType = type;
      matchText = text;
    }

    return {
      match,
      matchType,
      matchText,
    };
  }

  getRecentFilesSuggestions(
    inputInfo: InputInfo,
  ): (HeadingSuggestion | FileSuggestion)[] {
    const suggestions: (HeadingSuggestion | FileSuggestion)[] = [];
    const files = inputInfo?.currentWorkspaceEnvList?.mostRecentFiles;

    files?.forEach((file) => {
      if (this.shouldIncludeFile(file)) {
        const h1 = this.getFirstH1(file);
        const sugg = h1
          ? this.createHeadingSuggestion(inputInfo, h1, file, null)
          : this.createFileSuggestion(inputInfo, file, null);

        sugg.isRecentOpen = true;
        suggestions.push(sugg);
      }
    });

    return suggestions;
  }

  getOpenEditorSuggestions(inputInfo: InputInfo): EditorSuggestion[] {
    const suggestions: EditorSuggestion[] = [];
    const leaves = inputInfo?.currentWorkspaceEnvList?.openWorkspaceLeaves;

    leaves?.forEach((leaf) => {
      const file = leaf.view?.file;
      const sugg = EditorHandler.createSuggestion(
        inputInfo.currentWorkspaceEnvList,
        leaf,
        file,
        null,
      );

      suggestions.push(sugg);
    });

    return suggestions;
  }

  getInitialSuggestionList(
    inputInfo: InputInfo,
  ): (HeadingSuggestion | FileSuggestion | EditorSuggestion)[] {
    const openEditors = this.getOpenEditorSuggestions(inputInfo);
    const recentFiles = this.getRecentFilesSuggestions(inputInfo);

    return [...openEditors, ...recentFiles];
  }
}
