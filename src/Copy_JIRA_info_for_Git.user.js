// ==UserScript==
// @name         Jira Utils
// @namespace    https://github.com/TheBit/user-script-copy-jira-info-for-git
// @version      2.0.1
// @description  Helpful jira functionality
// @author       TheBit, D4ST1N
// @license MIT
// @require      https://cdnjs.cloudflare.com/ajax/libs/clipboard.js/1.7.1/clipboard.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/vue/2.5.16/vue.js
// @require      https://unpkg.com/axios/dist/axios.min.js
// @match        https://jira.betlab.com/browse/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // jira integration parameters
  const jip = {
    ticketNameSelector: '#summary-val',
    ticketIDSelector: '#key-val',
    ticketTypeSelector: '#type-val',
    containerSelector: '.ops-menus.aui-toolbar',
    ticketTypes: {
      task: 'task',
      story: 'story',
      techTask: 'tech task',
      defect: 'defect',
      productionDefect: 'production defect',
    },
    getTicketName() {
      return document.querySelector(this.ticketNameSelector).innerText;
    },
    getTicketID() {
      return document.querySelector(this.ticketIDSelector).innerText;
    },
    getTicketType() {
      return document.querySelector(this.ticketTypeSelector).innerText;
    },
    getContainer() {
      return document.querySelector(this.containerSelector);
    }
  };
  // gitLab integration parameters
  const gip = {
    access: {
      param: 'private_token',
      value: '5VK28u4H9d39NFv1r7sv',
    },
    filter: {
      param: 'search',
    },
    pageSize: {
      param: 'per_page',
      value: 50,
    },
    brandsBranchesFilter: 'master',
    hotfixBranchesFilter: 'release',
    projects: {
      mobile: {
        key: 'air/air-mobile',
        name: 'air-mobile',
        type: 'mobile',
        mainBranch: 'master',
        mainBrand: 'com',
      },
      desktop: {
        key: 'air/air-pm',
        name: 'air-pm',
        type: 'desktop',
        mainBranch: 'develop',
        mainBrand: 'com',
      },
    },
    url: 'https://git.betlab.com/api/v4/projects/{project}/repository/branches?{params}',
    branchUrl: 'https://git.betlab.com/{project}/tree/{branch}',
    getGitLabUrl(project, params) {
      return this.url.replace('{project}', encodeURIComponent(project)).replace('{params}', params);
    },
    getGitLabBranchUrl(project, branch) {
      return this.branchUrl.replace('{project}', project).replace('{branch}', branch);
    }
  };

  const notification = {
    config: {
      delay: 1500,
    },
    setStyles() {
      const style = document.createElement('style');
      style.innerHTML = `
      .ju-notice {
        position: absolute;
        z-index: 100;
        background: #455A64;
        color: #fff;
        display: flex;
        padding: 5px 10px;
        border-radius: 5px;
        transform: translate(-50%, -100%);
        animation-name: notice-out;
        animation-delay: .25s;
        animation-duration: 1.25s;
        animation-fill-mode: forwards;
      }
      @keyframes notice-out {
        0% {
          opacity: 1;
          transform: translate(-50%, -100%);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -200%);
        }
      }`;
      document.body.appendChild(style);
    },
    getNotificationID() {
      return Date.now();
    },
    createNotification() {
      const notification = document.createElement('div');
      notification.className = 'ju-notice';

      return notification;
    },
    getCoordinates(element) {
      const box = element.getBoundingClientRect();

      return {
        top: box.top + pageYOffset,
        left: box.left + pageXOffset
      };
    },
    show({element, message, config = this.config}) {
      if (element.$juNoticeID) {
        return;
      }
      const notification = this.createNotification();
      const elementPosition = this.getCoordinates(element);
      notification.innerHTML = message;
      notification.style.top = `${elementPosition.top}px`;
      notification.style.left = `${elementPosition.left + element.offsetWidth / 2}px`;
      document.body.appendChild(notification);
      const id = this.getNotificationID();
      const timer = setTimeout(() => {
        document.body.removeChild(notification);
        delete element.$juNoticeID;
        clearTimeout(timer);
      }, config.delay);
      element.$juNoticeID = id;
    }
  };

  Vue.component(
    'juactions',
    {
      template: `
          <div class="juactions-root">
            <div class="buttons-group">
              Branch: 
              <div
                v-for="issueType in issueTypes"
                :key="issueType.key"
                :class="{'action-button': true, 'action-button--selected': issueType.selected}"
                @click="selectType(issueTypes, issueType)"
              >
                {{ issueType.label }}
              </div>
            </div>
            <div class="group-separator"></div>
            <div class="buttons-group">
              From: 
              <div
                v-for="platform in platforms"
                :key="platform.key"
                :class="{'action-button': true, 'action-button--selected': platform.selected}"
                @click="selectType(platforms, platform)"
              >
                {{ platform.label }}
              </div>
            </div>
            <div class="buttons-group">
              <div
                v-for="branch in branches"
                :key="branch.key"
                :class="{'action-button': true, 'action-button--selected': branch.selected}"
                @click="selectType(branches, branch, false)"
              >
                {{ branch.label }}
              </div>
            </div>
            <div class="group-separator" v-if="showBranchName"></div>
            <div class="branch-name-block" v-show="showBranchName">
              To: 
              <input type="text" disabled class="branch-name__constant-part" :value="constantPart">
              <input type="text" class="branch-name__editable-part" v-model="editablePart" ref="editablePart" @input="formatBranchName">
              <div class="group-separator"></div>
              <div class="action-button copyButton" :data-clipboard-text="newBranchName" @click="copy">
                <span class="action-button__title">Copy</span>
                <span class="aui-icon aui-icon-small aui-iconfont-copy-clipboard action-button__icon"></span>
              </div>
              <div :class="{'action-button': true, 'action-button--view': branchExists, 'action-button--fork': !branchExists }" @click="createBranch">
                <span class="action-button__title">{{ branchExists ? 'View' : 'Fork' }}</span>
                <span
                  :class="{
                    'aui-icon': true,
                    'aui-icon-small': true,
                    'aui-iconfont-devtools-branch': !branchExists,
                    'aui-iconfont-view': branchExists,
                    'action-button__icon': true
                  }">
                </span>
              </div>
            </div>
            <div class="group-separator"></div>
            <div class="buttons-group">
              <div class="action-button copyButton" :data-clipboard-text="commitMessage" @click="copy">
                <span class="action-button__title">Commit message</span>
                <span class="aui-icon aui-icon-small aui-iconfont-devtools-commit action-button__icon"></span>
              </div>
            </div>
          </div>`,
      data() {
        return {
          styles: document.createElement('style'),
          baseStyles: `
          #juapp {
              display: flex;
              width: 100%;
          }
          .juactions-root {
              display: flex;
              width: 100%;
              padding: 5px 10px;
              background: #CFD8DC;
              align-items: center;
          }
          .buttons-group {
              margin-right: 10px;
              max-width: 30%;
              display: flex;
              flex-wrap: wrap;
              align-items: center;
          }
          .action-button {
              display: inline-flex;
              justify-content: center;
              align-items: center;
              font-size: 14px;
              background-color: #f5f5f5;
              color: #333;
              padding: 3px 10px;
              border: 1px solid #ccc;
              border-radius: 5px;
              cursor: pointer;
              transition: all .375s;
          }
          .action-button--selected {
              background-color: #4CAF50;
              color: #fff;
          }
          .action-button--view {
              background-color: #90A4AE;
              color: #fff;
          }
          .action-button--fork {
              background-color: #FFB74D;
              color: #fff;
          }
          .action-button:hover {
              margin-left: 0;
          }
          .action-button__icon {
              pointer-events: none;
          }
          .action-button--view .action-button__icon,
          .action-button--fork .action-button__icon {
              color: #fff;
          }
          .action-button__icon:not(:first-child) {
              margin-left: 5px;
          }
          .action-button__title {
              pointer-events: none;
          }
          .branch-name-block {
              display: flex;
              align-items: center;
          }
          .branch-name__constant-part {
              height: 28px;
              box-sizing: border-box;
              padding: 3px 0 3px 8px;
              background-color: #fff;
              border: 1px solid #ccc;
              color: #666;
              opacity: .8;
              margin-left: 5px;
              width: 150px;
              text-align: right;
          }
          .branch-name__editable-part {
              height: 28px;
              box-sizing: border-box;
              padding: 3px 8px 3px 0;
          }
          .group-separator {
              height: 80%;
              width: 1px;
              background-color: #d3d3d3;
              border-right: 1px solid #aaa;
              margin-left: 5px;
              margin-right: 15px;
          }`,
          issueTypes: [
            {
              label: 'Feature',
              key: 'feature',
              selected: false,
              filter: gip.brandsBranchesFilter,
            },
            {
              label: 'Bugfix',
              key: 'bugfix',
              selected: false,
              filter: gip.brandsBranchesFilter,
            },
            {
              label: 'Hotfix',
              key: 'hotfix',
              selected: false,
              filter: gip.hotfixBranchesFilter,
            },
          ],
          platforms: [
            {
              label: gip.projects.desktop.name,
              key: gip.projects.desktop.key,
              selected: false,
            },
            {
              label: gip.projects.mobile.name,
              key: gip.projects.mobile.key,
              selected: false,
            },
          ],
          branches: [],
          selectedBranchKey: '',
          initialBranchLabel: '',
          desktop: gip.projects.desktop.key,
          mobile: gip.projects.mobile.key,
          showBranchName: false,
          constantPart: '',
          editablePart: '',
          clipboard: undefined,
          branchExists: false,
          existedBranch: undefined,
          commitMessage: '',
        };
      },
      mounted() {
        notification.setStyles();
        this.createStyles();
        this.setCommitMessage();
        this.setInitialValues();
        this.clipboard = new Clipboard('.copyButton');
      },
      watch: {
        showBranchName() {
          this.editablePart = this.getEditablePart();
          this.$nextTick(() => {
            this.fixEditablePartWidth();
          });
        },
      },
      computed: {
        newBranchName() {
          return `${this.constantPart}${this.editablePart}`;
        }
      },
      methods:  {
        createStyles() {
          document.body.appendChild(this.styles);
          this.styles.innerHTML = this.baseStyles;
        },
        setInitialValues() {
          const initialPlatform = this.getInitialPlatform();
          const initialIssueType = this.getInitialIssueType();
          this.initialBranchLabel = this.getInitialBrand();
          this.issueTypes.filter(issueType => issueType.key === initialIssueType)[0].selected = true;
          this.selectType(this.platforms, this.platforms.filter(platform => platform.label === initialPlatform)[0]);
        },
        fixEditablePartWidth() {
          const temp = document.createElement('div');
          temp.innerHTML = this.$refs.editablePart.value;
          document.body.appendChild(temp);
          temp.style.display = 'inline-block';
          document.body.appendChild(temp);
          this.$refs.editablePart.style.width = `${temp.offsetWidth + 10}px`;
          document.body.removeChild(temp);
        },
        formatBranchName() {
          this.editablePart = this.formatToValidBranchName(this.editablePart.replace(/\s/ig, '-'), false);
          this.$nextTick(() => {
            this.fixEditablePartWidth();
          });
        },
        getSelected(array) {
          return array.filter(item => item.selected)[0];
        },
        selectType(types, selectedType, getBranches = true) {
          let previousSelected;
          types.forEach((type) => {
            if (type.selected) {
              previousSelected = type;
            }

            type.selected = false;
          });
          selectedType.selected = true;
          this.setConstantPart();

          if (getBranches && previousSelected !== selectedType) {
            const selectedPlatform = this.getSelected(this.platforms);
            const selectedIssueType = this.getSelected(this.issueTypes);

            if (selectedPlatform && selectedIssueType) {
              this.getBranches(selectedPlatform.key, selectedIssueType.filter);
            }
          }
        },
        setCommitMessage() {
          const ticket = jip.getTicketID();
          const ticketName = jip.getTicketName();
          const ticketNameFormatted = ticketName.replace(/\s\s/ig, ' ').replace(/\[.*?\]/ig, '').trim();
          this.commitMessage = `[${ticket}] ${ticketNameFormatted}`;
        },
        setConstantPart() {
          const ticket = jip.getTicketID();
          const issueType = this.issueTypes.filter(issue => issue.selected)[0];
          const brand = this.branches.filter(branch => branch.selected)[0];

          if (!brand || !issueType) {
            this.showBranchName = false;
            return;
          }

          this.showBranchName = true;
          this.constantPart = `${issueType.key}/${brand.label}/${ticket}-`;
          this.checkBranchExists();
        },
        getTicketName() {
          return document.querySelector(jip.ticketNameSelector).innerText;
        },
        getTicketID() {
          return document.querySelector(jip.ticketIDSelector).innerText;
        },
        getEditablePart() {
          console.log(this.editablePart);

          if (this.editablePart) {
            return this.editablePart;
          }

          const ticketName = jip.getTicketName();
          return this.formatToValidBranchName(ticketName);
        },
        formatToValidBranchName(string, limit = 5) {
          let formattedString = string.replace(/["'`]/g, '') /* remove quotes */
                                      .replace(/\s-\s/g, '') /* remove dashes */
                                      .replace(/\s\s/ig, ' ') /* Replace double spaces with single space */
                                      .replace(/\[.*?]/ig, '') /* Strip tags in square brackets e.g.: [tag] */
                                      .trim() /* After removing square brackets - there might be leading white space left, so need to trim */
                                      .replace(/\s/ig, '-') /* Replace all spaces with dashes */
                                      .replace(/^[./]|\.\.|@{|[\/.]$|^@$|[~^:\x00-\x20\x7F\s?*[\]\\]/ig, ''); /* Strip all forbidden chars */
          return limit ? formattedString.split('-').slice(0, limit).join('-') : formattedString;
        },
        getBranches(type, search) {
          const params = [
            {
              key: gip.access.param,
              value: gip.access.value,
            },
            {
              key: gip.filter.param,
              value: search,
            },
            {
              key: gip.pageSize.param,
              value: gip.pageSize.value,
            },
          ];
          axios.get(gip.getGitLabUrl(type, this.processParams(params)))
               .then((response) => {
                 console.log(response);
                 this.filterBranches(response.data, type, search);
                 this.setConstantPart();
               })
               .catch((error) => {
                 console.log(error);
               });
        },
        checkBranchExists() {
          const selectedPlatform = this.getSelected(this.platforms);
          const params = [
            {
              key: gip.access.param,
              value: gip.access.value,
            },
            {
              key: gip.filter.param,
              value: this.constantPart,
            },
          ];
          axios.get(gip.getGitLabUrl(selectedPlatform.key, this.processParams(params)))
               .then((response) => {
                 console.log(response);
                 this.branchExists = response.data.length > 0;
                 this.existedBranch = response.data[0];
               })
               .catch((error) => {
                 console.log(error);
               });
        },
        filterBranches(branches, type, search) {
          const selectedBranch = this.getSelected(this.branches);

          if (selectedBranch) {
            this.selectedBranchKey = selectedBranch.key;
          }

          if (type === this.desktop && search !== gip.hotfixBranchesFilter) {
            this.branches = [
              {
                label:    gip.projects.desktop.mainBrand,
                key:      gip.projects.desktop.mainBranch,
                value:    gip.projects.desktop.mainBranch,
                selected: this.initialBranchLabel === gip.projects.desktop.mainBrand
                          || this.selectedBranchKey === gip.projects.desktop.mainBranch
                          || false,
              },
            ];
          } else if (type === this.mobile && search !== gip.hotfixBranchesFilter) {
            this.branches = [
              {
                label:    gip.projects.mobile.mainBrand,
                key:      gip.projects.mobile.mainBranch,
                value:    gip.projects.mobile.mainBranch,
                selected: this.initialBranchLabel === gip.projects.mobile.mainBrand
                          || this.selectedBranchKey === gip.projects.mobile.mainBranch
                          || false,
              },
            ];
          } else {
            this.branches = [];
          }

          branches.forEach((branch) => {
            if (search === gip.brandsBranchesFilter) {
              const branchNameParts = branch.name.split('-');

              if (branchNameParts.length > 1) {
                this.branches.push(
                  {
                    key:      branch.name,
                    label:    branchNameParts[1],
                    value:    branchNameParts[1],
                    selected: this.initialBranchLabel === branchNameParts[1] || this.selectedBranchKey === branch.name || false,
                  }
                );
              }
            } else if (search === gip.hotfixBranchesFilter) {
              const branchNameParts = branch.name.split('/');

              if (branchNameParts.length > 1 && branch.name.indexOf(new Date().getFullYear()) !== -1) {
                let branchBrand = this.getBranchBrand(branchNameParts[0]);

                if (branchBrand === gip.hotfixBranchesFilter
                    || branchBrand === gip.projects.mobile.type
                    || branchBrand === gip.projects.desktop.type
                ) {
                  branchBrand = gip.projects.desktop.mainBrand;
                }

                const branchIndex = this.getBranchIndexByBrand(branchBrand);
                const branchObject = {
                  key:      branch.name,
                  label:    branchBrand,
                  value:    branchNameParts[1],
                  selected: this.initialBranchLabel === branchBrand || this.selectedBranchKey === branch.name || false,
                };

                if (branchIndex !== undefined) {
                  const existDate = new Date(this.branches[branchIndex].value);
                  const currentDate = new Date(branchNameParts[1]);

                  if (currentDate > existDate) {
                    this.branches[branchIndex] = branchObject;
                  }
                } else {
                  this.branches.push(branchObject);
                }
              }
            }
          });

          this.initialBranchLabel = undefined;
        },
        getBranchBrand(branch) {
          const branchParts = branch.split('-');
          return branchParts[branchParts.length - 1];
        },
        getBranchIndexByBrand(brand) {
          let branchIndex;
          this.branches.forEach((branch, index) => {
            if (branch.label === brand) {
              branchIndex = index;
            }
          });

          return branchIndex;
        },
        processParams(params) {
          return params.map(param => `${param.key}=${param.value}`).join('&');
        },
        createBranch(e) {
          const selectedPlatform = this.getSelected(this.platforms);
          if (this.branchExists) {
            const win = window.open(gip.getGitLabBranchUrl(selectedPlatform.key, this.existedBranch.name), '_blank');
            win.focus();
          } else {
            const selectedBranch = this.getSelected(this.branches);
            const params = [
              {
                key:   gip.access.param,
                value: gip.access.value,
              },
              {
                key:   'branch',
                value: this.newBranchName,
              },
              {
                key:   'ref',
                value: selectedBranch.key,
              },
            ];
            axios.post(gip.getGitLabUrl(selectedPlatform.key, this.processParams(params)))
                 .then((response) => {
                   console.log(response);
                   notification.show({ element: e.target, message: 'Created :)' });
                   this.checkBranchExists();
                 })
                 .catch((error) => {
                   console.log(error);
                 });
          }
        },
        copy(e) {
          notification.show({ element: e.target, message: 'Copied :)' });
        },
        getInitialIssueType() {
          const issueType = jip.getTicketType().toLowerCase().trim();
          const issueTypesMapping = {
            feature: [
              jip.ticketTypes.task,
              jip.ticketTypes.story,
              jip.ticketTypes.techTask,
            ],
            bugfix: [
              jip.ticketTypes.defect
            ],
            hotfix: [
              jip.ticketTypes.productionDefect
            ],
          };
          let initialIssueType;

          Object.entries(issueTypesMapping).forEach(([key, value]) => {
            if (value.includes(issueType)) {
              initialIssueType = key;
            }
          });

          return initialIssueType;
        },
        getInitialPlatform() {
          const ticketName = jip.getTicketName();

          if (ticketName.toLowerCase().indexOf(gip.projects.mobile.type) !== -1) {
            return gip.projects.mobile.name;
          }

          return gip.projects.desktop.name;
        },
        getInitialBrand() {
          // TODO remove hardcoded brands
          const ticketName = jip.getTicketName();

          if (ticketName.toLowerCase().indexOf('[cy]') !== -1) {
            return 'cy';
          } else if (ticketName.toLowerCase().indexOf('[ge]') !== -1) {
            return 'ge';
          } else if (ticketName.toLowerCase().indexOf('[ru]') !== -1) {
            return 'ru';
          } else if (ticketName.toLowerCase().indexOf('[mt]') !== -1) {
            return 'mt';
          } else if (ticketName.toLowerCase().indexOf('[tz]') !== -1) {
            return 'tz';
          }

          return 'com';
        }
      },
    }
  );

  const appRoot = document.createElement('div');
  appRoot.id = 'juapp';
  appRoot.innerHTML = '<juactions></juactions>';
  const appContainer = jip.getContainer();
  appContainer.appendChild(appRoot);
  new Vue(
    {
      el: '#juapp',
    }
  );
})();
