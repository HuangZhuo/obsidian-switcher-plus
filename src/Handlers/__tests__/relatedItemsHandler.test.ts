import { stripMDExtensionFromPath } from 'src/utils';
import { SwitcherPlusSettings } from 'src/settings';
import { InputInfo, SourcedParsedCommand } from 'src/switcherPlus';
import { RelatedItemsHandler } from 'src/Handlers';
import {
  AliasSuggestion,
  Mode,
  EditorSuggestion,
  StarredSuggestion,
  RelatedItemsSuggestion,
} from 'src/types';
import {
  WorkspaceLeaf,
  App,
  MetadataCache,
  Workspace,
  TFile,
  Vault,
  TAbstractFile,
  TFolder,
  prepareQuery,
  fuzzySearch,
  PreparedQuery,
  SearchResult,
  renderResults,
  Keymap,
} from 'obsidian';
import {
  rootSplitEditorFixtures,
  relatedItemsTrigger,
  makeFileStarredItem,
  makeLeaf,
  makeFuzzyMatch,
  makePreparedQuery,
} from '@fixtures';
import { mock, MockProxy } from 'jest-mock-extended';

const file1 = new TFile();
const file2 = new TFile();
const file3 = new TFile();
const file4 = new TFile();

function makeFileTree(sourceFile: TFile): TFolder {
  const mockFolder = jest.fn<
    TFolder,
    [name: string, path: string, children: Array<TAbstractFile>]
  >((name, path, children = []) => {
    return {
      vault: null,
      parent: null,
      isRoot: undefined,
      name,
      path,
      children,
    };
  });

  const root = new mockFolder('', '/', [
    file1,
    sourceFile,
    file2,
    new mockFolder('l1Folder1', 'l1Folder1', [
      file3,
      new mockFolder('l2Folder1', 'l1Folder1/l2Folder1', [file4]),
    ]),
  ]);

  return root;
}

describe('relatedItemsHandler', () => {
  const rootFixture = rootSplitEditorFixtures[0];
  let settings: SwitcherPlusSettings;
  let mockApp: MockProxy<App>;
  let mockWorkspace: MockProxy<Workspace>;
  let sut: RelatedItemsHandler;
  let mockMetadataCache: MockProxy<MetadataCache>;
  let mockRootSplitLeaf: MockProxy<WorkspaceLeaf>;
  let filterText: string;

  beforeAll(() => {
    mockMetadataCache = mock<MetadataCache>();
    mockMetadataCache.getFileCache.mockImplementation((_f) => rootFixture.cachedMetadata);

    mockWorkspace = mock<Workspace>({ activeLeaf: null });
    mockApp = mock<App>({
      workspace: mockWorkspace,
      metadataCache: mockMetadataCache,
      vault: mock<Vault>(),
    });

    settings = new SwitcherPlusSettings(null);
    jest
      .spyOn(settings, 'relatedItemsListCommand', 'get')
      .mockReturnValue(relatedItemsTrigger);

    const rootSplitSourceFile = new TFile();
    rootSplitSourceFile.parent = makeFileTree(rootSplitSourceFile);

    mockRootSplitLeaf = makeLeaf();
    mockRootSplitLeaf.view.file = rootSplitSourceFile;
  });

  beforeEach(() => {
    // reset for each test because symbol mode will use saved data from previous runs
    sut = new RelatedItemsHandler(mockApp, settings);
  });

  describe('commandString', () => {
    it('should return relatedItemsListCommand trigger', () => {
      expect(sut.commandString).toBe(relatedItemsTrigger);
    });
  });

  describe('validateCommand', () => {
    filterText = 'foo';

    it('should validate parsed input in prefix (active editor) mode', () => {
      const inputInfo = new InputInfo(`${relatedItemsTrigger}${filterText}`);

      sut.validateCommand(inputInfo, 0, filterText, null, mockRootSplitLeaf);

      expect(inputInfo.mode).toBe(Mode.RelatedItemsList);

      const cmd = inputInfo.parsedCommand();
      expect(cmd.parsedInput).toBe(filterText);
      expect(cmd.isValidated).toBe(true);
    });

    it('should validate parsed input for file based suggestion', () => {
      const targetFile = new TFile();
      const inputInfo = new InputInfo('', Mode.Standard);
      const sugg: AliasSuggestion = {
        file: targetFile,
        alias: 'foo',
        type: 'alias',
        match: null,
      };

      sut.validateCommand(inputInfo, 0, '', sugg, null);

      expect(inputInfo.mode).toBe(Mode.RelatedItemsList);

      const cmd = inputInfo.parsedCommand() as SourcedParsedCommand;
      expect(cmd.isValidated).toBe(true);
      expect(cmd.source).toEqual(
        expect.objectContaining({
          file: targetFile,
          leaf: null,
          suggestion: sugg,
          isValidSource: true,
        }),
      );
    });

    it('should validate parsed input for editor suggestion', () => {
      const targetLeaf = makeLeaf();
      const inputInfo = new InputInfo('', Mode.EditorList);
      mockWorkspace.activeLeaf = targetLeaf; // <-- set the target as a currently open leaf

      const sugg: EditorSuggestion = {
        item: targetLeaf,
        file: targetLeaf.view.file,
        type: 'editor',
        match: null,
      };

      sut.validateCommand(inputInfo, 0, '', sugg, null);

      expect(inputInfo.mode).toBe(Mode.RelatedItemsList);

      const cmd = inputInfo.parsedCommand() as SourcedParsedCommand;
      expect(cmd.isValidated).toBe(true);
      expect(cmd.source).toEqual(
        expect.objectContaining({
          file: targetLeaf.view.file,
          leaf: targetLeaf,
          suggestion: sugg,
          isValidSource: true,
        }),
      );

      mockWorkspace.activeLeaf = null;
    });

    it('should validate parsed input for starred file suggestion', () => {
      const targetFile = new TFile();
      const inputInfo = new InputInfo('', Mode.StarredList);
      const item = makeFileStarredItem(targetFile.basename);

      const sugg: StarredSuggestion = {
        item,
        type: 'starred',
        file: targetFile,
        match: null,
      };

      (mockApp.vault as MockProxy<Vault>).getAbstractFileByPath
        .calledWith(targetFile.path)
        .mockReturnValueOnce(targetFile);

      sut.validateCommand(inputInfo, 0, '', sugg, null);

      expect(inputInfo.mode).toBe(Mode.RelatedItemsList);

      const cmd = inputInfo.parsedCommand() as SourcedParsedCommand;
      expect(cmd.isValidated).toBe(true);
      expect(cmd.source).toEqual(
        expect.objectContaining({
          file: targetFile,
          leaf: null,
          suggestion: sugg,
          isValidSource: true,
        }),
      );
    });

    it('should validate and identify active editor as matching the file suggestion target', () => {
      const targetLeaf = makeLeaf();
      const inputInfo = new InputInfo('', Mode.Standard);
      mockWorkspace.activeLeaf = targetLeaf; // <-- set the target as a currently open leaf

      const sugg: AliasSuggestion = {
        file: targetLeaf.view.file,
        alias: 'foo',
        type: 'alias',
        match: null,
      };

      sut.validateCommand(inputInfo, 0, '', sugg, null);

      expect(inputInfo.mode).toBe(Mode.RelatedItemsList);

      const cmd = inputInfo.parsedCommand() as SourcedParsedCommand;
      expect(cmd.isValidated).toBe(true);
      expect(cmd.source).toEqual(
        expect.objectContaining({
          file: targetLeaf.view.file,
          leaf: targetLeaf,
          suggestion: sugg,
          isValidSource: true,
        }),
      );

      mockWorkspace.activeLeaf = null;
    });

    it('should validate and identify in-active editor as matching the file suggestion target file', () => {
      const targetLeaf = makeLeaf();
      const inputInfo = new InputInfo('', Mode.Standard);
      const sugg: AliasSuggestion = {
        file: targetLeaf.view.file,
        alias: 'foo',
        type: 'alias',
        match: null,
      };

      mockWorkspace.activeLeaf = null; // <-- clear out active leaf
      mockWorkspace.iterateAllLeaves.mockImplementation((callback) => {
        callback(targetLeaf); // <-- report targetLeaf and an in-active open leaf
      });

      sut.validateCommand(inputInfo, 0, '', sugg, null);

      expect(inputInfo.mode).toBe(Mode.RelatedItemsList);

      const cmd = inputInfo.parsedCommand() as SourcedParsedCommand;
      expect(cmd.isValidated).toBe(true);
      expect(cmd.source).toEqual(
        expect.objectContaining({
          file: targetLeaf.view.file,
          leaf: targetLeaf,
          suggestion: sugg,
          isValidSource: true,
        }),
      );

      mockWorkspace.iterateAllLeaves.mockReset();
    });
  });

  describe('getSuggestions', () => {
    const mockPrepareQuery = jest.mocked<typeof prepareQuery>(prepareQuery);
    const mockFuzzySearch = jest.mocked<typeof fuzzySearch>(fuzzySearch);

    test('with falsy input, it should return an empty array', () => {
      const results = sut.getSuggestions(null);

      expect(results).not.toBeNull();
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(0);
    });

    test('that RelatedItemsSuggestion have a file property to enable interop with other plugins (like HoverEditor)', () => {
      const inputInfo = new InputInfo(relatedItemsTrigger);
      sut.validateCommand(inputInfo, 0, '', null, mockRootSplitLeaf);

      const results = sut.getSuggestions(inputInfo);

      expect(results.every((v) => v.file !== null)).toBe(true);
    });

    test('with default settings, it should return suggestions', () => {
      const inputInfo = new InputInfo(relatedItemsTrigger);
      sut.validateCommand(inputInfo, 0, '', null, mockRootSplitLeaf);

      const results = sut.getSuggestions(inputInfo);

      expect(inputInfo.mode).toBe(Mode.RelatedItemsList);
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(2);
      expect(results.every((sugg) => sugg.type === 'relatedItems')).toBe(true);
      expect(results.every((sugg) => sugg.relationType === 'diskLocation')).toBe(true);

      const files = results.map((v) => v.file);
      expect(files).toEqual(expect.arrayContaining([file1, file2]));

      expect(mockPrepareQuery).toHaveBeenCalled();
    });

    test('with filter search term, it should return only matching symbol suggestions', () => {
      filterText = file1.basename;
      mockPrepareQuery.mockReturnValueOnce(makePreparedQuery(filterText));
      mockFuzzySearch.mockImplementation(
        (_q: PreparedQuery, text: string): SearchResult => {
          const match = makeFuzzyMatch();
          return text.includes(filterText) ? match : null;
        },
      );

      const inputInfo = new InputInfo(`${relatedItemsTrigger}${filterText}`);
      sut.validateCommand(inputInfo, 0, filterText, null, mockRootSplitLeaf);

      const results = sut.getSuggestions(inputInfo);

      expect(inputInfo.mode).toBe(Mode.RelatedItemsList);
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(1);
      expect(results.every((sugg) => sugg.type === 'relatedItems')).toBe(true);
      expect(results.every((sugg) => sugg.relationType === 'diskLocation')).toBe(true);

      expect(mockPrepareQuery).toHaveBeenCalled();
      expect(mockFuzzySearch).toHaveBeenCalled();

      mockFuzzySearch.mockReset();
    });

    test('with existing filter search term, it should continue refining suggestions for the previous target', () => {
      // 1) setup first initial run
      filterText = file1.basename.slice(0, file1.basename.length / 2);
      mockPrepareQuery.mockReturnValueOnce(makePreparedQuery(filterText));

      mockFuzzySearch.mockImplementation((_q: PreparedQuery, text: string) => {
        const match = makeFuzzyMatch();
        return text.includes(filterText) ? match : null;
      });

      let inputInfo = new InputInfo(`${relatedItemsTrigger}${filterText}`);

      sut.validateCommand(inputInfo, 0, filterText, null, mockRootSplitLeaf);

      let results = sut.getSuggestions(inputInfo);

      expect(inputInfo.mode).toBe(Mode.RelatedItemsList);
      expect(results).toBeInstanceOf(Array);
      expect(results.every((sugg) => sugg.type === 'relatedItems')).toBe(true);
      expect(results.every((sugg) => sugg.relationType === 'diskLocation')).toBe(true);

      let cmd = inputInfo.parsedCommand() as SourcedParsedCommand;
      expect(cmd.source.file).toBe(mockRootSplitLeaf.view.file);
      mockFuzzySearch.mockReset();

      // 2) setup second run, which refines the filterText from the first run
      filterText = file1.basename;
      mockPrepareQuery.mockReturnValueOnce(makePreparedQuery(filterText));

      mockFuzzySearch.mockImplementation((q: PreparedQuery, text: string) => {
        const match = makeFuzzyMatch();
        return text.endsWith(q.query) ? match : null;
      });

      const mockTempLeaf = makeLeaf();
      inputInfo = new InputInfo(`${relatedItemsTrigger}${filterText}`);

      // note the use of a different leaf than the first run, because it should use the
      // leaf from the previous run
      sut.validateCommand(inputInfo, 0, filterText, null, mockTempLeaf);

      results = sut.getSuggestions(inputInfo);

      expect(inputInfo.mode).toBe(Mode.RelatedItemsList);
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(1);
      expect(results[0].file).toEqual(file1);
      expect(results.every((sugg) => sugg.type === 'relatedItems')).toBe(true);
      expect(results.every((sugg) => sugg.relationType === 'diskLocation')).toBe(true);
      expect(mockPrepareQuery).toHaveBeenCalled();

      cmd = inputInfo.parsedCommand() as SourcedParsedCommand;
      expect(cmd.source.file).not.toBe(mockTempLeaf.view.file);

      // expect the source file to be the same as the first run
      expect(cmd.source.file).toBe(mockRootSplitLeaf.view.file);
      mockFuzzySearch.mockReset();
    });
  });

  describe('renderSuggestion', () => {
    it('should not throw an error with a null suggestion', () => {
      expect(() => sut.renderSuggestion(null, null)).not.toThrow();
    });

    it('should render a suggestion with match offsets', () => {
      const mockParentEl = mock<HTMLElement>();
      const mockRenderResults = jest.mocked<typeof renderResults>(renderResults);

      const match = makeFuzzyMatch();
      const sugg = mock<RelatedItemsSuggestion>({ file: file1, match });

      sut.renderSuggestion(sugg, mockParentEl);

      expect(mockRenderResults).toHaveBeenCalledWith(
        mockParentEl,
        stripMDExtensionFromPath(file1),
        match,
      );
    });
  });

  describe('onChooseSuggestion', () => {
    it('should not throw an error with a null suggestion', () => {
      expect(() => sut.onChooseSuggestion(null, null)).not.toThrow();
    });

    it('should activate the existing workspaceLeaf that contains the related file', () => {
      const eState = { active: true, focus: true };
      const sugg: RelatedItemsSuggestion = {
        type: 'relatedItems',
        relationType: 'diskLocation',
        file: file1,
        match: null,
      };

      // set file1 as the active leaf
      mockWorkspace.activeLeaf = makeLeaf();

      // set file1 as the file for active leaf
      mockWorkspace.activeLeaf.view.file = file1;

      sut.onChooseSuggestion(sugg, null);

      expect(mockWorkspace.setActiveLeaf).toHaveBeenCalledWith(
        mockWorkspace.activeLeaf,
        true,
      );
      expect(mockWorkspace.activeLeaf.view.setEphemeralState).toHaveBeenCalledWith(
        eState,
      );
    });

    test('with Mod down, it should it should create a new workspaceLeaf for the target file that contains the symbol, and scroll via eState', () => {
      const mockLeaf = makeLeaf();
      const evt = mock<MouseEvent>();
      const mockKeymap = jest.mocked<typeof Keymap>(Keymap);
      const isModDown = true;
      const eState = { active: true, focus: true };
      const sugg: RelatedItemsSuggestion = {
        type: 'relatedItems',
        relationType: 'diskLocation',
        file: file1,
        match: null,
      };

      mockKeymap.isModEvent.mockReturnValueOnce(isModDown);
      mockLeaf.openFile.mockResolvedValueOnce();
      mockWorkspace.getLeaf.mockReturnValueOnce(mockLeaf);

      sut.onChooseSuggestion(sugg, evt);

      expect(mockKeymap.isModEvent).toHaveBeenCalledWith(evt);
      expect(mockWorkspace.getLeaf).toHaveBeenCalledWith(true);
      expect(mockLeaf.openFile).toHaveBeenCalledWith(file1, { eState });
    });
  });

  describe('getRelatedFiles', () => {
    test('with excludeRelatedFolders unset, it should include files from subfolders', () => {
      const sourceFile = new TFile();
      sourceFile.parent = makeFileTree(sourceFile);

      // don't set any folder filter
      jest.spyOn(settings, 'excludeRelatedFolders', 'get').mockReturnValueOnce([]);

      const results = sut.getRelatedFiles(sourceFile);

      expect(results).toHaveLength(4);
      expect(results).toEqual(expect.arrayContaining([file1, file2, file3, file4]));
    });

    it('should exclude files from subfolders', () => {
      const sourceFile = new TFile();
      sourceFile.parent = makeFileTree(sourceFile);

      const results = sut.getRelatedFiles(sourceFile);

      expect(results).toHaveLength(2);
      expect(results).toEqual(expect.arrayContaining([file1, file2]));
    });

    it('should include files that are already open in an editor', () => {
      const findOpenEditorSpy = jest.spyOn(sut, 'findOpenEditor');
      const sourceFile = new TFile();
      sourceFile.parent = makeFileTree(sourceFile);

      // set file1 as the active leaf
      mockWorkspace.activeLeaf = makeLeaf();

      // set file1 as the file for active leaf
      mockWorkspace.activeLeaf.view.file = file1;

      const results = sut.getRelatedFiles(sourceFile);

      expect(results).toHaveLength(2);
      expect(results).toEqual(expect.arrayContaining([file1, file2]));
      expect(findOpenEditorSpy).not.toHaveBeenCalled();

      findOpenEditorSpy.mockRestore();
    });

    test('with excludeOpenRelatedFiles enabled, it should exclude files that are already open in an editor', () => {
      const sourceFile = new TFile();
      sourceFile.parent = makeFileTree(sourceFile);

      // exclude files already open
      jest.spyOn(settings, 'excludeOpenRelatedFiles', 'get').mockReturnValueOnce(true);

      mockWorkspace.activeLeaf = makeLeaf();

      // set file1 as the file for active leaf
      mockWorkspace.activeLeaf.view.file = file1;

      const results = sut.getRelatedFiles(sourceFile);

      expect(results).toHaveLength(1);
      expect(results).toEqual(expect.arrayContaining([file2]));
    });
  });
});