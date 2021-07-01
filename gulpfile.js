const path = require('path');
const fs = require('fs-extra');
const request = require('request');
const yargs = require('yargs');
const artifactoryUpload = require('gulp-artifactory-upload');
const gulp = require('gulp');
const gulpDel = require('del');
const gulpRename = require('gulp-rename');
const gulpReplace = require('gulp-replace');
const gulpTs = require('gulp-typescript');
const gutil = require('gulp-util');
const globby = require('globby');
const jeditor = require('gulp-json-editor');
const es = require('event-stream');
const mergeStream = require('merge-stream');
const typescript = require('typescript');
const { paths, pathAllFiles } = require('./config/paths');
const {
  fileHashsum,
  fullVersion,
  getBuildInfo,
  npmInstallTask,
  runSonnarQubeScanner,
  tfxCommand
} = require('./config/utils');
const { scanner } = require('./config/config');
const packageJSON = require('./package.json');

function copyIconsTask(icon = 'task_icon.png') {
  return () =>
    mergeStream(
      globby.sync(path.join(paths.extensions.root, '*'), { nodir: false }).map(extension => {
        let iconPipe = gulp
          .src(path.join(extension, 'tasks_icons', icon))
          .pipe(gulpRename('icon.png'));
        globby.sync(path.join(extension, 'tasks', '*', '*'), { nodir: false }).forEach(dir => {
          iconPipe = iconPipe.pipe(
            gulp.dest(
              path.join(paths.build.extensions.root, path.relative(paths.extensions.root, dir))
            )
          );
        });
        return iconPipe;
      })
    );
}

/*
 * =========================
 *  BUILD TASKS
 * =========================
 */
gulp.task('clean', () => gulpDel([path.join(paths.build.root, '**'), '*.vsix']));

gulp.task('extension:copy', () =>
  mergeStream(
    gulp.src(
      path.join(paths.extensions.root, '**', '@(vss-extension.json|extension-icon.png|*.md)')
    ),
    gulp.src(pathAllFiles(paths.extensions.root, '**', 'img')),
    gulp.src(pathAllFiles(paths.extensions.root, '**', 'icons')),
    gulp.src(pathAllFiles(paths.extensions.root, '**', 'templates'))
  ).pipe(gulp.dest(paths.build.extensions.root))
);

gulp.task('tasks:old:copy', () =>
  gulp.src(pathAllFiles(paths.extensions.tasks.old)).pipe(gulp.dest(paths.build.extensions.root))
);

gulp.task('tasks:old:common', () => {
  let commonPipe = gulp.src(pathAllFiles(paths.common.old));
  globby.sync(paths.extensions.tasks.old, { nodir: false }).forEach(dir => {
    commonPipe = commonPipe.pipe(
      gulp.dest(path.join(paths.build.extensions.root, path.relative(paths.extensions.root, dir)))
    );
  });
  return commonPipe;
});

gulp.task('tasks:old:bundle', gulp.series('tasks:old:copy', 'tasks:old:common'));

gulp.task('npminstall', () =>
  gulp
    .src([
      path.join(paths.extensions.tasks.new, 'package.json'),
      path.join(paths.common.new, 'package.json')
    ])
    .pipe(es.mapSync(file => npmInstallTask(file.path)))
);

gulp.task('tasks:new:ts', () =>
  gulp
    .src([
      path.join(paths.extensions.tasks.new, '**', '*.ts'),
      '!' + path.join('**', 'node_modules', '**'),
      '!' + path.join('**', '__tests__', '**')
    ])
    .pipe(gulpTs.createProject('./tsconfig.json', { typescript })())
    .once('error', () => {
      this.once('finish', () => process.exit(1));
    })
    .pipe(gulpReplace('../../../../../common/ts/', './common/'))
    .pipe(gulp.dest(paths.build.extensions.root))
);

gulp.task('tasks:new:common:ts', () => {
  let commonPipe = gulp
    .src([
      path.join(paths.common.new, '**', '*.ts'),
      '!' + path.join('**', 'node_modules', '**'),
      '!' + path.join('**', '__tests__', '**')
    ])
    .pipe(gulpTs.createProject('./tsconfig.json', { typescript })())
    .once('error', () => {
      this.once('finish', () => process.exit(1));
    });
  globby.sync(paths.extensions.tasks.new, { nodir: false }).forEach(dir => {
    commonPipe = commonPipe.pipe(
      gulp.dest(
        path.join(paths.build.extensions.root, path.relative(paths.extensions.root, dir), 'common')
      )
    );
  });
  return commonPipe;
});

gulp.task('tasks:new:copy', () =>
  gulp
    .src([
      path.join(paths.extensions.tasks.new, 'task.json'),
      pathAllFiles(paths.extensions.tasks.new, 'node_modules')
    ])
    .pipe(gulp.dest(paths.build.extensions.root))
);

gulp.task('tasks:new:common:copy', () => {
  let commonPipe = gulp.src(pathAllFiles(paths.common.new, 'node_modules'));
  globby.sync(paths.extensions.tasks.new, { nodir: false }).forEach(dir => {
    commonPipe = commonPipe.pipe(
      gulp.dest(
        path.join(
          paths.build.extensions.root,
          path.relative(paths.extensions.root, dir),
          'node_modules'
        )
      )
    );
  });
  return commonPipe;
});

gulp.task(
  'tasks:new:bundle',
  gulp.series('npminstall', 'tasks:new:ts', 'tasks:new:common:ts', 'tasks:new:copy', 'tasks:new:common:copy')
);

gulp.task('tasks:icons', copyIconsTask());

gulp.task('tasks:version', () => {
  return gulp
    .src(path.join(paths.build.extensions.tasks, '**', 'task.json'))
    .pipe(
      jeditor(task => ({
        ...task,
        helpMarkDown:
          `Version: ${task.version.Major}.${task.version.Minor}.${task.version.Patch}. ` +
          task.helpMarkDown
      }))
    )
    .pipe(gulp.dest(paths.build.extensions.root));
});

gulp.task(
  'copy',
  gulp.series(
    'extension:copy',
    'tasks:old:bundle',
    'tasks:new:bundle',
    'tasks:icons',
    'tasks:version'
  )
);

gulp.task('tfx', done => {
  globby
    .sync(path.join(paths.build.extensions.root, '*'), { nodir: false })
    .forEach(extension => tfxCommand(extension, packageJSON));
  done();
});

gulp.task('build', gulp.series('clean', 'copy', 'tfx'));

/*
 * =========================
 *  TEST TASKS
 * =========================
 */
gulp.task('tfx:test', done => {
  globby
    .sync(path.join(paths.build.extensions.root, '*'), { nodir: false })
    .forEach(extension =>
      tfxCommand(extension, packageJSON, `--publisher ` + (yargs.argv.publisher || 'foo'))
    );
  done();
});

gulp.task('extension:test', () =>
  mergeStream(
    globby.sync(path.join(paths.extensions.root, '*'), { nodir: false }).map(extension =>
      mergeStream(
        gulp
          .src(path.join(extension, 'extension-icon.test.png'))
          .pipe(gulpRename('extension-icon.png'))
          .pipe(
            gulp.dest(
              path.join(
                paths.build.extensions.root,
                path.relative(paths.extensions.root, extension)
              )
            )
          ),
        gulp
          .src(
            path.join(
              paths.build.extensions.root,
              path.relative(paths.extensions.root, extension),
              'vss-extension.json'
            ),
            { base: './' }
          )
          .pipe(jeditor(fs.readJsonSync(path.join(extension, 'vss-extension.test.json'))))
          .pipe(gulp.dest('./'))
      )
    )
  )
);

gulp.task('tasks:icons:test', copyIconsTask('task_icon.test.png'));

gulp.task('test', gulp.series('extension:test', 'tasks:icons:test'));

gulp.task('build:test', gulp.series('clean', 'copy', 'test', 'tfx:test'));

/*
 * =========================
 *  DEPLOY TASKS
 * =========================
 */
gulp.task('deploy:vsix', () => {
  if (process.env.CIRRUS_BRANCH !== 'master' && process.env.CIRRUS_PR === 'false') {
    gutil.log('Not on master nor PR, skip deploy:vsix');
    return gutil.noop;
  }
  if (process.env.CIRRUS_PR === 'true' && process.env.DEPLOY_PULL_REQUEST === 'false') {
    gutil.log('On PR, but artifacts should not be deployed, skip deploy:vsix');
    return gutil.noop;
  }
  const { name } = packageJSON;
  const packageVersion = fullVersion(packageJSON.version);
  return mergeStream(
    globby.sync(path.join(paths.build.root, '*.vsix')).map(filePath => {
      const [sha1, md5] = fileHashsum(filePath);
      return gulp
        .src(filePath)
        .pipe(
          artifactoryUpload({
            url:
              process.env.ARTIFACTORY_URL +
              '/' +
              process.env.ARTIFACTORY_DEPLOY_REPO +
              '/org/sonarsource/scanner/vsts/' +
              name +
              '/' +
              packageVersion,
            username: process.env.ARTIFACTORY_DEPLOY_USERNAME,
            password: process.env.ARTIFACTORY_DEPLOY_PASSWORD,
            properties: {
              'vcs.revision': process.env.CIRRUS_CHANGE_IN_REPO,
              'vcs.branch': process.env.CIRRUS_BRANCH,
              'build.name': name,
              'build.number': process.env.CIRRUS_BUILD_ID
            },
            request: {
              headers: {
                'X-Checksum-MD5': md5,
                'X-Checksum-Sha1': sha1
              }
            }
          })
        )
        .on('error', gutil.log);
    })
  );
});

gulp.task('deploy:buildinfo', () => {
  if (process.env.CIRRUS_BRANCH !== 'master' && process.env.CIRRUS_PR === 'false') {
    gutil.log('Not on master nor PR, skip deploy:buildinfo');
    return gutil.noop;
  }
  if (process.env.CIRRUS_PR === 'true' && process.env.DEPLOY_PULL_REQUEST === 'false') {
    gutil.log('On PR, but artifacts should not be deployed, skip deploy:buildinfo');
    return gutil.noop;
  }
  console.log('deploy build info', getBuildInfo(packageJSON))
  return request
    .put(
      {
        url: process.env.ARTIFACTORY_URL + '/api/build',
        json: getBuildInfo(packageJSON)
      },
      (error, response, body) => {
        if (error) {
          gutil.log('error:', error);
        }
      }
    )
    .auth(process.env.ARTIFACTORY_DEPLOY_USERNAME, process.env.ARTIFACTORY_DEPLOY_PASSWORD, true);
});

gulp.task('deploy', gulp.series('build', 'deploy:buildinfo', 'deploy:vsix'));

/*
 * =========================
 *  MISC TASKS
 * =========================
 */
gulp.task('sonarqube', done => {
  if (process.env.CIRRUS_BRANCH === 'master' && process.env.CIRRUS_PR === 'false') {
    runSonnarQubeScanner(done, { 'sonar.analysis.sha1': process.env.CIRRUS_CHANGE_IN_REPO });
  } else if (process.env.CIRRUS_PR !== 'false') {
    runSonnarQubeScanner(done, {
      'sonar.analysis.prNumber': process.env.CIRRUS_PR,
      'sonar.branch.name': process.env.CIRRUS_BRANCH,
      'sonar.branch.target': process.env.CIRRUS_BASE_BRANCH,
      'sonar.analysis.sha1': process.env.CIRRUS_BASE_SHA
    });
  } else {
    done();
  }
});

gulp.task('promote', () => {
  if (process.env.CIRRUS_BRANCH !== 'master' && process.env.CIRRUS_PR === 'false') {
    gutil.log('Not on master nor PR, skip promote');
    return gutil.noop;
  }
  return request
    .get(
      {
        url: [
          process.env.PROMOTE_URL,
          process.env.GITHUB_REPO,
          process.env.GITHUB_BRANCH,
          process.env.BUILD_NUMBER,
          process.env.PULL_REQUEST
        ].join('/')
      },
      (error, response, body) => {
        if (error) {
          gutil.log('error:', error);
        }
      }
    )
    .auth(null, null, true, process.env.GCF_ACCESS_TOKEN);
});

gulp.task('burgr', () => {
  if (process.env.CIRRUS_BRANCH !== 'master' && process.env.CIRRUS_PR === 'false') {
    gutil.log('Not on master nor PR, skip burgr');
    return gutil.noop;
  }
  const packageVersion = fullVersion(packageJSON.version);
  const urls = ['sonarqube', 'sonarcloud'].map(variant => `${process.env.ARTIFACTORY_URL}/sonarsource/org/sonarsource/scanner/vsts/sonar-scanner-vsts/${packageVersion}/sonar-scanner-vsts-${packageVersion}-${variant}.vsix`).join(',');
  return request
    .post(
      {
        url: [
          process.env.BURGR_URL,
          'api/promote',
          process.env.CIRRUS_REPO_OWNER,
          process.env.CIRRUS_REPO_NAME,
          process.env.CIRRUS_BUILD_ID
        ].join('/'),
        json: {
          version: packageVersion,
          url: urls,
          buildNumber: process.env.BUILD_NUMBER
        }
      },
      (error, response, body) => {
        if (error) {
          gutil.log('error:', error);
        }
      }
    )
    .auth(process.env.BURGR_USERNAME, process.env.BURGR_PASSWORD, true);
});

gulp.task('default', gulp.series('build'));
