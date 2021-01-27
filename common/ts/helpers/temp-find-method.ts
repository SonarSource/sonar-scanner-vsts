/* istanbul ignore file */
/*Can be deleted once https://www.npmjs.com/package/azure-pipelines-task-lib v3.1.0 will be release */
import * as tl from "azure-pipelines-task-lib/task";
import path = require("path");
import fs = require("fs");
import im = require("azure-pipelines-task-lib/internal");
import minimatch = require("minimatch");

function _debugMatchOptions(options: tl.MatchOptions): void {
  tl.debug(`matchOptions.debug: "${options.debug}"`);
  tl.debug(`matchOptions.nobrace: "${options.nobrace}"`);
  tl.debug(`matchOptions.noglobstar: "${options.noglobstar}"`);
  tl.debug(`matchOptions.dot: "${options.dot}"`);
  tl.debug(`matchOptions.noext: "${options.noext}"`);
  tl.debug(`matchOptions.nocase: "${options.nocase}"`);
  tl.debug(`matchOptions.nonull: "${options.nonull}"`);
  tl.debug(`matchOptions.matchBase: "${options.matchBase}"`);
  tl.debug(`matchOptions.nocomment: "${options.nocomment}"`);
  tl.debug(`matchOptions.nonegate: "${options.nonegate}"`);
  tl.debug(`matchOptions.flipNegate: "${options.flipNegate}"`);
}

function _getDefaultMatchOptions(): tl.MatchOptions {
  return <tl.MatchOptions>{
    debug: false,
    nobrace: true,
    noglobstar: false,
    dot: true,
    noext: false,
    nocase: process.platform == "win32",
    nonull: false,
    matchBase: false,
    nocomment: false,
    nonegate: false,
    flipNegate: false,
  };
}

function _debugFindOptions(options: tl.FindOptions): void {
  tl.debug(`findOptions.allowBrokenSymbolicLinks: "${options.allowBrokenSymbolicLinks}"`);
  tl.debug(`findOptions.followSpecifiedSymbolicLink: "${options.followSpecifiedSymbolicLink}"`);
  tl.debug(`findOptions.followSymbolicLinks: "${options.followSymbolicLinks}"`);
}

function _getDefaultFindOptions(): tl.FindOptions {
  return <tl.FindOptions>{
    allowBrokenSymbolicLinks: false,
    followSpecifiedSymbolicLink: true,
    followSymbolicLinks: true,
  };
}

/**
 * Determines the find root from a list of patterns. Performs the find and then applies the glob patterns.
 * Supports interleaved exclude patterns. Unrooted patterns are rooted using defaultRoot, unless
 * matchOptions.matchBase is specified and the pattern is a basename only. For matchBase cases, the
 * defaultRoot is used as the find root.
 *
 * @param  defaultRoot   default path to root unrooted patterns. falls back to System.DefaultWorkingDirectory or process.cwd().
 * @param  patterns      pattern or array of patterns to apply
 * @param  findOptions   defaults to { followSymbolicLinks: true }. following soft links is generally appropriate unless deleting files.
 * @param  matchOptions  defaults to { dot: true, nobrace: true, nocase: process.platform == "win32" }
 */
export function findMatch(
  defaultRoot: string,
  patterns: string[] | string,
  findOptions?: tl.FindOptions,
  matchOptions?: tl.MatchOptions
): string[] {
  // apply defaults for parameters and trace
  defaultRoot = defaultRoot || tl.getVariable("system.defaultWorkingDirectory") || process.cwd();
  tl.debug(`defaultRoot: "${defaultRoot}"`);
  patterns = patterns || [];
  patterns = typeof patterns == "string" ? ([patterns] as string[]) : patterns;
  findOptions = findOptions || _getDefaultFindOptions();
  _debugFindOptions(findOptions);
  matchOptions = matchOptions || _getDefaultMatchOptions();
  _debugMatchOptions(matchOptions);

  // normalize slashes for root dir
  defaultRoot = im._normalizeSeparators(defaultRoot);

  let results: { [key: string]: string } = {};
  let originalMatchOptions = matchOptions;
  for (let pattern of patterns || []) {
    tl.debug(`pattern: "${pattern}"`);

    // trim and skip empty
    pattern = (pattern || "").trim();
    if (!pattern) {
      tl.debug("skipping empty pattern");
      continue;
    }

    // clone match options
    let matchOptions = im._cloneMatchOptions(originalMatchOptions);

    // skip comments
    if (!matchOptions.nocomment && im._startsWith(pattern, "#")) {
      tl.debug("skipping comment");
      continue;
    }

    // set nocomment - brace expansion could result in a leading "#"
    matchOptions.nocomment = true;

    // determine whether pattern is include or exclude
    let negateCount = 0;
    if (!matchOptions.nonegate) {
      while (pattern.charAt(negateCount) == "!") {
        negateCount++;
      }

      pattern = pattern.substring(negateCount); // trim leading "!"
      if (negateCount) {
        tl.debug(`trimmed leading "!". pattern: "${pattern}"`);
      }
    }

    let isIncludePattern =
      negateCount == 0 ||
      (negateCount % 2 == 0 && !matchOptions.flipNegate) ||
      (negateCount % 2 == 1 && matchOptions.flipNegate);

    // set nonegate - brace expansion could result in a leading "!"
    matchOptions.nonegate = true;
    matchOptions.flipNegate = false;

    // expand braces - required to accurately interpret findPath
    let expanded: string[];
    let preExpanded: string = pattern;
    if (matchOptions.nobrace) {
      expanded = [pattern];
    } else {
      // convert slashes on Windows before calling braceExpand(). unfortunately this means braces cannot
      // be escaped on Windows, this limitation is consistent with current limitations of minimatch (3.0.3).
      tl.debug("expanding braces");
      let convertedPattern = process.platform == "win32" ? pattern.replace(/\\/g, "/") : pattern;
      expanded = (minimatch as any).braceExpand(convertedPattern);
    }

    // set nobrace
    matchOptions.nobrace = true;

    for (let pattern of expanded) {
      if (expanded.length != 1 || pattern != preExpanded) {
        tl.debug(`pattern: "${pattern}"`);
      }

      // trim and skip empty
      pattern = (pattern || "").trim();
      if (!pattern) {
        tl.debug("skipping empty pattern");
        continue;
      }

      if (isIncludePattern) {
        // determine the findPath
        let findInfo: im._PatternFindInfo = im._getFindInfoFromPattern(
          defaultRoot,
          pattern,
          matchOptions
        );
        let findPath: string = findInfo.findPath;
        tl.debug(`findPath: "${findPath}"`);

        if (!findPath) {
          tl.debug("skipping empty path");
          continue;
        }

        // perform the find
        tl.debug(`statOnly: "${findInfo.statOnly}"`);
        let findResults: string[] = [];
        if (findInfo.statOnly) {
          // simply stat the path - all path segments were used to build the path
          try {
            fs.statSync(findPath);
            findResults.push(findPath);
          } catch (err) {
            if (err.code != "ENOENT") {
              throw err;
            }

            tl.debug("ENOENT");
          }
        } else {
          findResults = find(findPath, findOptions);
        }

        tl.debug(`found ${findResults.length} paths`);

        // apply the pattern
        tl.debug("applying include pattern");
        if (findInfo.adjustedPattern != pattern) {
          tl.debug(`adjustedPattern: "${findInfo.adjustedPattern}"`);
          pattern = findInfo.adjustedPattern;
        }

        let matchResults: string[] = minimatch.match(findResults, pattern, matchOptions);
        tl.debug(matchResults.length + " matches");

        // union the results
        for (let matchResult of matchResults) {
          let key = process.platform == "win32" ? matchResult.toUpperCase() : matchResult;
          results[key] = matchResult;
        }
      } else {
        // check if basename only and matchBase=true
        if (
          matchOptions.matchBase &&
          !im._isRooted(pattern) &&
          (process.platform == "win32" ? pattern.replace(/\\/g, "/") : pattern).indexOf("/") < 0
        ) {
          // do not root the pattern
          tl.debug("matchBase and basename only");
        } else {
          // root the exclude pattern
          pattern = im._ensurePatternRooted(defaultRoot, pattern);
          tl.debug(`after ensurePatternRooted, pattern: "${pattern}"`);
        }

        // apply the pattern
        tl.debug("applying exclude pattern");
        let matchResults: string[] = minimatch.match(
          Object.keys(results).map((key: string) => results[key]),
          pattern,
          matchOptions
        );
        tl.debug(matchResults.length + " matches");

        // substract the results
        for (let matchResult of matchResults) {
          let key = process.platform == "win32" ? matchResult.toUpperCase() : matchResult;
          delete results[key];
        }
      }
    }
  }

  let finalResult: string[] = Object.keys(results)
    .map((key: string) => results[key])
    .sort();
  tl.debug(finalResult.length + " final results");
  return finalResult;
}

/**
 * Recursively finds all paths a given path. Returns an array of paths.
 *
 * @param     findPath  path to search
 * @param     options   optional. defaults to { followSymbolicLinks: true }. following soft links is generally appropriate unless deleting files.
 * @returns   string[]
 */
export function find(findPath: string, options?: tl.FindOptions): string[] {
  if (!findPath) {
    tl.debug("no path specified");
    return [];
  }

  // normalize the path, otherwise the first result is inconsistently formatted from the rest of the results
  // because path.join() performs normalization.
  findPath = path.normalize(findPath);

  // debug trace the parameters
  tl.debug(`findPath: "${findPath}"`);
  options = options || _getDefaultFindOptions();
  _debugFindOptions(options);

  // return empty if not exists
  try {
    fs.lstatSync(findPath);
  } catch (err) {
    if (err.code == "ENOENT") {
      tl.debug("0 results");
      return [];
    }

    throw err;
  }

  try {
    let result: string[] = [];

    // push the first item
    let stack: _FindItem[] = [new _FindItem(findPath, 1)];
    let traversalChain: string[] = []; // used to detect cycles

    while (stack.length) {
      // pop the next item and push to the result array
      let item = stack.pop()!; // non-null because `stack.length` was truthy
      result.push(item.path);

      // stat the item.  the stat info is used further below to determine whether to traverse deeper
      //
      // stat returns info about the target of a symlink (or symlink chain),
      // lstat returns info about a symlink itself
      let stats: fs.Stats;
      if (options.followSymbolicLinks) {
        try {
          // use stat (following all symlinks)
          stats = fs.statSync(item.path);
        } catch (err) {
          if (err.code == "ENOENT" && options.allowBrokenSymbolicLinks) {
            // fallback to lstat (broken symlinks allowed)
            stats = fs.lstatSync(item.path);
            tl.debug(`  ${item.path} (broken symlink)`);
          } else {
            throw err;
          }
        }
      } else if (options.followSpecifiedSymbolicLink && result.length == 1) {
        try {
          // use stat (following symlinks for the specified path and this is the specified path)
          stats = fs.statSync(item.path);
        } catch (err) {
          if (err.code == "ENOENT" && options.allowBrokenSymbolicLinks) {
            // fallback to lstat (broken symlinks allowed)
            stats = fs.lstatSync(item.path);
            tl.debug(`  ${item.path} (broken symlink)`);
          } else {
            throw err;
          }
        }
      } else {
        // use lstat (not following symlinks)
        stats = fs.lstatSync(item.path);
      }

      // note, isDirectory() returns false for the lstat of a symlink
      if (stats.isDirectory()) {
        tl.debug(`  ${item.path} (directory)`);

        if (options.followSymbolicLinks) {
          // get the realpath
          let realPath: string = fs.realpathSync(item.path);

          // fixup the traversal chain to match the item level
          while (traversalChain.length >= item.level) {
            traversalChain.pop();
          }

          // test for a cycle
          if (traversalChain.some((x: string) => x == realPath)) {
            tl.debug("    cycle detected");
            continue;
          }

          // update the traversal chain
          traversalChain.push(realPath);
        }

        // push the child items in reverse onto the stack
        let childLevel: number = item.level + 1;
        let childItems: _FindItem[] = fs
          .readdirSync(item.path)
          .map((childName: string) => new _FindItem(path.join(item.path, childName), childLevel));
        for (var i = childItems.length - 1; i >= 0; i--) {
          stack.push(childItems[i]);
        }
      } else {
        tl.debug(`  ${item.path} (file)`);
      }
    }

    tl.debug(`${result.length} results`);
    return result;
  } catch (err) {
    throw new Error(tl.loc("LIB_OperationFailed", "find", err.message));
  }
}

class _FindItem {
  public path: string;
  public level: number;

  public constructor(path: string, level: number) {
    this.path = path;
    this.level = level;
  }
}
