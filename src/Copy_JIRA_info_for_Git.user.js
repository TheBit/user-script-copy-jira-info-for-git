// ==UserScript==
// @name         Copy JIRA info for Git
// @namespace    https://github.com/TheBit/user-script-copy-jira-info-for-git
// @version      1.12
// @description  try to take over the world!
// @author       TheBit
// @license MIT
// @require      https://cdnjs.cloudflare.com/ajax/libs/clipboard.js/1.7.1/clipboard.min.js
// @match        https://jira.betlab.com/browse/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    //Tmp 1
    let $ = selector => document.querySelector(selector);
    let currentBrand = '';

    function createBranchButton(name) {
        let button = document.createElement('button');
        button.classList.add(`${name}Btn`, 'issueKind', 'btn', 'btn-sm');
        button.setAttribute('data-clipboard-text', getBranchName(name));
        button.innerHTML = name;
        return button;
    }

    function createCommitButton(name) {
        let button = document.createElement('button');
        button.classList.add(`${name}Btn`, 'commit-btn', 'btn', 'btn-sm');
        button.setAttribute('data-name', name);
        button.innerHTML = name;
        return button;
    }

    function getBranchName(name) {
        const issueKind = name.toLowerCase();
        const brand = currentBrand;
        const jiraTicket = $('#key-val').innerText;
        const ticketDescription = getTicketDescription();
        return `${issueKind}${brand ? `/${brand}` : brand}/${jiraTicket}-${ticketDescription}`;
    }

    function createBrandsSelect(brands) {
      const select = document.createElement('select');
      select.classList.add('brandsSelect', 'btn', 'btn-sm');
      select.setAttribute('data-name', brands[0]);
      brands.forEach((brand) => {
        select.innerHTML += `<option value="${brand}">${brand ? brand.toUpperCase() : 'none'}</option>`;
      });
      select.onchange = changeBrand;
      return select;
    }
    
    function getTicketDescription() {
      const ticketName = $('#summary-val').innerText;
      return ticketName.replace(/["'\-]/g, "") /* remove quotes and dashes */
                       .replace(/\s\s/ig, ' ') /* Replace double spaces with single space */
                       .replace(/\[.*?]/ig, '') /* Strip tags in square brackets e.g.: [tag] */
                       .trim() /* After removing square brackets - there might be leading white space left, so need to trim */
                       .replace(/\s/ig, '-') /* Replace all spaces with dashes */
                       .replace(/^[./]|\.\.|@{|[\/.]$|^@$|[~^:\x00-\x20\x7F\s?*[\]\\]/ig, '') /* Strip all forbidden chars */
                       .split('-') /* Take only first 5 words */
                       .slice(0, 5)
                       .join('-');
    }
    
    function changeBrand(e) {
      currentBrand = e.target.value;
      updateBranchNames();
    }

    function updateBranchNames() {
      const buttons = document.querySelectorAll('.issueKind');
      let name;
      buttons.forEach((button) => {
        name = button.innerText;
        button.setAttribute('data-clipboard-text', getBranchName(name));
      });
    }

    function handleCommitClick(button, grabbedInfoForCommit) {
        button.classList.toggle('btn-primary');
        let commitButtons = document.querySelectorAll('.commit-btn');
        let result = Array.prototype.reduce.call(
          commitButtons,
          (sum, currentItem) => currentItem.classList.contains('btn-primary')
                                ? `${sum}[${currentItem.dataset.name}]`
                                : sum,
          ''
        );

        button.setAttribute('data-clipboard-text', grabbedInfoForCommit.replace('%tags%', result));
    }

    let grabbedInfoForCommit = `${$('#summary-val').innerText}`.
        replace(/\s\s/ig, ' ')./* Replace double spaces with single space */
        replace(/\[.*?\]/ig, '')./* Strip tags in square brackets e.g.: [tag] */
        trim()./* After removing square brackets - there might be leading white space left, so need to trim */
        split(' ').slice(0, 5).join(' '); /* Take only first 5 words */
    grabbedInfoForCommit = `[${$('#key-val').innerText}]%tags% ${grabbedInfoForCommit}`;

    const branchButtonNames = ['feature', 'bugfix', 'hotfix'];
    const branchButtons = branchButtonNames.map(name => createBranchButton(name));

    const brands = ['', 'com', 'cy', 'ru', 'tz', 'mt', 'ge'];
    const brandsSelect = createBrandsSelect(brands);

    const commitButtonNames = ['fix', 'add', 'upd', 'del', 'version', 'revert', 'nginx'];
    const commitButtons = commitButtonNames.map(name => createCommitButton(name));

    let container = document.createElement('div');
    container.classList.add('btn-group', 'copyContainer');

    if ((localStorage.getItem('JiraInfoForGit') && localStorage.getItem('JiraInfoForGit') === 'closed')) {
        container.classList.add('hide');
    }

    let branchLabel = document.createElement('span');
    branchLabel.innerHTML = `<img class="clippy" src="https://clipboardjs.com/assets/images/clippy.svg" 
                                width="13" alt="Copy branch to clipboard"> Branch: `;

    container.appendChild(branchLabel);
    branchButtons.forEach(button => container.appendChild(button));
    container.appendChild(brandsSelect);

    let closeButton = document.createElement('button');
    closeButton.classList.add('close-btn');
    closeButton.innerHTML = 'x';
    container.appendChild(closeButton);
    closeButton.onclick = () => {
        container.classList.add('hide');
        showButton.classList.remove('hide');
        localStorage.setItem('JiraInfoForGit', 'closed');
    };

    let br = document.createElement('br');
    container.appendChild(br);

    let commitLabel = document.createElement('span');
    commitLabel.innerHTML = `<img class="clippy" src="https://clipboardjs.com/assets/images/clippy.svg"
                                  width="13" alt="Copy commit to clipboard"> Commit:`;

    container.appendChild(commitLabel);
    commitButtons.forEach((button) => {
        container.appendChild(button);
        button.onclick = () => handleCommitClick(button, grabbedInfoForCommit);
    });

    $(".toolbar-split.toolbar-split-left").appendChild(container);

    let showButton = document.createElement('button');
    showButton.classList.add('ellipsis-expander', 'showButton');

    if ((localStorage.getItem('JiraInfoForGit') && localStorage.getItem('JiraInfoForGit') === 'opened')
        || !localStorage.getItem('JiraInfoForGit')) {
        showButton.classList.add('hide');
    }

    showButton.innerHTML = '&hellip;';
    $(".aui-page-header-inner").appendChild(showButton);
    showButton.onclick = () => {
        container.classList.remove('hide');
        showButton.classList.add('hide');
        localStorage.setItem('JiraInfoForGit', 'opened');
    };

    var clipboard = new Clipboard(document.querySelectorAll('.btn-sm'));
    clipboard.on('success', function(event) {
        console.debug('Successfully copied to clipboard: ', event);

        event.trigger.setAttribute('aria-label', 'Copied ;)');

        event.trigger.classList.add('tooltipped', `tooltipped-${event.trigger.classList.contains('commit-btn') ? 'n' : 's'}`, 'tooltipped-no-delay');

        setTimeout(() => event.trigger.classList.
        remove('tooltipped', 'tooltipped-n', 'tooltipped-s', 'tooltipped-no-delay'), 1000);
    });

    clipboard.on('error', function(event) {
        console.warn('Error during copy to clipboard: ', event);

        event.trigger.setAttribute('aria-label', 'Error during copying to clipboard :(');

        event.trigger.classList.add('tooltipped', `tooltipped-${event.trigger.classList.contains('commit-btn') ? 'n' : 's'}`, 'tooltipped-no-delay');

        setTimeout(() => event.trigger.classList.
        remove('tooltipped', 'tooltipped-n', 'tooltipped-s', 'tooltipped-no-delay'), 1000);
    });

    //copy from: https://www.npmjs.com/package/primer-buttons
    //and from: https://www.npmjs.com/package/primer-tooltips
    let style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML =
        `.hide {\n
                display: none !important;\n
            }\n
            .showButton {\n
                float: right;\n
                padding: 5px;\n
            }\n
            .copyContainer {\n
                float: right;\n
                background-color: #DDDDDD;\n
                padding: 5px;\n
            }\n
            .close-btn {\n
                float: right;\n
                background-color: #DDDDDD;\n
                font-size: 18px;\n
                font-family: Arial;\n
                position: absolute;\n
                right: 21px;\n
                margin-top: -4px;\n
                border: none;\n
                padding-left: 10px;\n
                padding-right: 10px;\n
            }\n
            .clippy {\n
                margin-top: -3px;\n
                position: relative;\n
                top: 3px;\n
            }\n
            .btn{position:relative;display:inline-block;padding:6px 12px;font-size:14px;font-weight:600;line-height:20px;white-space:nowrap;vertical-align:middle;cursor:pointer;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;background-repeat:repeat-x;background-position:-1px -1px;background-size:110% 110%;border:1px solid rgba(27,31,35,0.2);border-radius:0.25em;-webkit-appearance:none;-moz-appearance:none;appearance:none}.btn i{font-style:normal;font-weight:500;opacity:0.6}.btn .octicon{vertical-align:text-top}.btn .Counter{color:#586069;text-shadow:none;background-color:rgba(27,31,35,0.1)}.btn:hover{text-decoration:none;background-repeat:repeat-x}.btn:focus{outline:0}.btn:disabled,.btn.disabled{cursor:default;background-position:0 0}.btn:active,.btn.selected{background-image:none}.btn{color:#24292e;background-color:#eff3f6;background-image:linear-gradient(-180deg, #fafbfc 0%, #eff3f6 90%)}.btn:focus,.btn.focus{box-shadow:0 0 0 0.2em rgba(3,102,214,0.3)}.btn:hover,.btn.hover{background-color:#e6ebf1;background-image:linear-gradient(-180deg, #f0f3f6 0%, #e6ebf1 90%);background-position:0 -0.5em;border-color:rgba(27,31,35,0.35)}.btn:active,.btn.selected{background-color:#e9ecef;background-image:none;border-color:rgba(27,31,35,0.35);box-shadow:inset 0 0.15em 0.3em rgba(27,31,35,0.15)}.btn:disabled,.btn.disabled{color:rgba(36,41,46,0.4);background-color:#eff3f6;background-image:none;border-color:rgba(27,31,35,0.2);box-shadow:none}.btn-primary{color:#fff;background-color:#28a745;background-image:linear-gradient(-180deg, #34d058 0%, #28a745 90%)}.btn-primary:focus,.btn-primary.focus{box-shadow:0 0 0 0.2em rgba(52,208,88,0.3)}.btn-primary:hover,.btn-primary.hover{background-color:#269f42;background-image:linear-gradient(-180deg, #2fcb53 0%, #269f42 90%);background-position:0 -0.5em;border-color:rgba(27,31,35,0.5)}.btn-primary:active,.btn-primary.selected{background-color:#279f43;background-image:none;border-color:rgba(27,31,35,0.5);box-shadow:inset 0 0.15em 0.3em rgba(27,31,35,0.15)}.btn-primary:disabled,.btn-primary.disabled{color:rgba(255,255,255,0.75);background-color:#94d3a2;background-image:none;border-color:rgba(27,31,35,0.2);box-shadow:none}.btn-primary .Counter{color:#29b249;background-color:#fff}.btn-purple{color:#fff;background-color:#643ab0;background-image:linear-gradient(-180deg, #7e55c7 0%, #643ab0 90%)}.btn-purple:focus,.btn-purple.focus{box-shadow:0 0 0 0.2em rgba(126,85,199,0.3)}.btn-purple:hover,.btn-purple.hover{background-color:#5f37a8;background-image:linear-gradient(-180deg, #784ec5 0%, #5f37a8 90%);background-position:0 -0.5em;border-color:rgba(27,31,35,0.5)}.btn-purple:active,.btn-purple.selected{background-color:#613ca4;background-image:none;border-color:rgba(27,31,35,0.5);box-shadow:inset 0 0.15em 0.3em rgba(27,31,35,0.15)}.btn-purple:disabled,.btn-purple.disabled{color:rgba(255,255,255,0.75);background-color:#b19cd7;background-image:none;border-color:rgba(27,31,35,0.2);box-shadow:none}.btn-purple .Counter{color:#683cb8;background-color:#fff}.btn-blue{color:#fff;background-color:#0361cc;background-image:linear-gradient(-180deg, #0679fc 0%, #0361cc 90%)}.btn-blue:focus,.btn-blue.focus{box-shadow:0 0 0 0.2em rgba(6,121,252,0.3)}.btn-blue:hover,.btn-blue.hover{background-color:#035cc2;background-image:linear-gradient(-180deg, #0374f4 0%, #035cc2 90%);background-position:0 -0.5em;border-color:rgba(27,31,35,0.5)}.btn-blue:active,.btn-blue.selected{background-color:#045cc1;background-image:none;border-color:rgba(27,31,35,0.5);box-shadow:inset 0 0.15em 0.3em rgba(27,31,35,0.15)}.btn-blue:disabled,.btn-blue.disabled{color:rgba(255,255,255,0.75);background-color:#81b0e5;background-image:none;border-color:rgba(27,31,35,0.2);box-shadow:none}.btn-blue .Counter{color:#0366d6;background-color:#fff}.btn-danger{color:#cb2431;background-color:#fafbfc;background-image:linear-gradient(-180deg, #fafbfc 0%, #eff3f6 90%)}.btn-danger:focus{box-shadow:0 0 0 0.2em rgba(203,36,49,0.3)}.btn-danger:hover{color:#fff;background-color:#cb2431;background-image:linear-gradient(-180deg, #de4450 0%, #cb2431 90%);border-color:rgba(27,31,35,0.5)}.btn-danger:hover .Counter{color:#fff}.btn-danger:active,.btn-danger.selected{color:#fff;background-color:#b5202c;background-image:none;border-color:rgba(27,31,35,0.5);box-shadow:inset 0 0.15em 0.3em rgba(27,31,35,0.15)}.btn-danger:disabled,.btn-danger.disabled{color:rgba(203,36,49,0.4);background-color:#eff3f6;background-image:none;border-color:rgba(27,31,35,0.2);box-shadow:none}.btn-outline{color:#0366d6;background-color:#fff;background-image:none}.btn-outline .Counter{background-color:rgba(27,31,35,0.07)}.btn-outline:hover,.btn-outline:active,.btn-outline.selected{color:#fff;background-color:#0366d6;background-image:none;border-color:#0366d6}.btn-outline:hover .Counter,.btn-outline:active .Counter,.btn-outline.selected .Counter{color:#0366d6;background-color:#fff}.btn-outline:focus{border-color:#0366d6;box-shadow:0 0 0 0.2em rgba(3,102,214,0.3)}.btn-outline:disabled,.btn-outline.disabled{color:rgba(27,31,35,0.3);background-color:#fff;border-color:rgba(27,31,35,0.15);box-shadow:none}.btn-with-count{float:left;border-top-right-radius:0;border-bottom-right-radius:0}.btn-sm{padding:3px 10px;font-size:12px;line-height:20px}.btn-large{padding:0.75em 1.25em;font-size:inherit;border-radius:6px}.hidden-text-expander{display:block}.hidden-text-expander.inline{position:relative;top:-1px;display:inline-block;margin-left:5px;line-height:0}.hidden-text-expander a,.ellipsis-expander{display:inline-block;height:12px;padding:0 5px 5px;font-size:12px;font-weight:600;line-height:6px;color:#444d56;text-decoration:none;vertical-align:middle;background:#dfe2e5;border:0;border-radius:1px}.hidden-text-expander a:hover,.ellipsis-expander:hover{text-decoration:none;background-color:#c6cbd1}.hidden-text-expander a:active,.ellipsis-expander:active{color:#fff;background-color:#2188ff}.social-count{float:left;padding:3px 10px;font-size:12px;font-weight:600;line-height:20px;color:#24292e;vertical-align:middle;background-color:#fff;border:1px solid rgba(27,31,35,0.2);border-left:0;border-top-right-radius:3px;border-bottom-right-radius:3px}.social-count:hover,.social-count:active{text-decoration:none}.social-count:hover{color:#0366d6;cursor:pointer}.btn-block{display:block;width:100%;text-align:center}.btn-link{display:inline-block;padding:0;font-size:inherit;color:#0366d6;text-decoration:none;white-space:nowrap;cursor:pointer;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;background-color:transparent;border:0;-webkit-appearance:none;-moz-appearance:none;appearance:none}.btn-link:hover{text-decoration:underline}.btn-link:disabled,.btn-link:disabled:hover{color:rgba(88,96,105,0.5);cursor:default}.BtnGroup{display:inline-block;vertical-align:middle}.BtnGroup::before{display:table;content:""}.BtnGroup::after{display:table;clear:both;content:""}.BtnGroup+.BtnGroup,.BtnGroup+.btn{margin-left:5px}.BtnGroup-item{position:relative;float:left;border-right-width:0;border-radius:0}.BtnGroup-item:first-child{border-top-left-radius:3px;border-bottom-left-radius:3px}.BtnGroup-item:last-child{border-right-width:1px;border-top-right-radius:3px;border-bottom-right-radius:3px}.BtnGroup-item.selected,.BtnGroup-item:focus,.BtnGroup-item:active,.BtnGroup-item:hover{border-right-width:1px}.BtnGroup-item.selected+.BtnGroup-item,.BtnGroup-item.selected+.BtnGroup-form .BtnGroup-item,.BtnGroup-item:focus+.BtnGroup-item,.BtnGroup-item:focus+.BtnGroup-form .BtnGroup-item,.BtnGroup-item:active+.BtnGroup-item,.BtnGroup-item:active+.BtnGroup-form .BtnGroup-item,.BtnGroup-item:hover+.BtnGroup-item,.BtnGroup-item:hover+.BtnGroup-form .BtnGroup-item{border-left-width:0}.BtnGroup-form{float:left}.BtnGroup-form:first-child .BtnGroup-item{border-top-left-radius:3px;border-bottom-left-radius:3px}.BtnGroup-form:last-child .BtnGroup-item{border-right-width:1px;border-top-right-radius:3px;border-bottom-right-radius:3px}.BtnGroup-form .BtnGroup-item{border-right-width:0;border-radius:0}.BtnGroup-form.selected .BtnGroup-item,.BtnGroup-form:focus .BtnGroup-item,.BtnGroup-form:active .BtnGroup-item,.BtnGroup-form:hover .BtnGroup-item{border-right-width:1px}.BtnGroup-form.selected+.BtnGroup-item,.BtnGroup-form.selected+.BtnGroup-form .BtnGroup-item,.BtnGroup-form:focus+.BtnGroup-item,.BtnGroup-form:focus+.BtnGroup-form .BtnGroup-item,.BtnGroup-form:active+.BtnGroup-item,.BtnGroup-form:active+.BtnGroup-form .BtnGroup-item,.BtnGroup-form:hover+.BtnGroup-item,.BtnGroup-form:hover+.BtnGroup-form .BtnGroup-item{border-left-width:0}\n
            .tooltipped{position:relative}.tooltipped::after{position:absolute;z-index:1000000;display:none;padding:5px 8px;font:normal normal 11px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol";-webkit-font-smoothing:subpixel-antialiased;color:#fff;text-align:center;text-decoration:none;text-shadow:none;text-transform:none;letter-spacing:normal;word-wrap:break-word;white-space:pre;pointer-events:none;content:attr(aria-label);background:rgba(27,31,35,0.8);border-radius:3px;opacity:0}.tooltipped::before{position:absolute;z-index:1000001;display:none;width:0;height:0;color:rgba(27,31,35,0.8);pointer-events:none;content:"";border:5px solid transparent;opacity:0}@-webkit-keyframes tooltip-appear{from{opacity:0}to{opacity:1}}@keyframes tooltip-appear{from{opacity:0}to{opacity:1}}.tooltipped:hover::before,.tooltipped:hover::after,.tooltipped:active::before,.tooltipped:active::after,.tooltipped:focus::before,.tooltipped:focus::after{display:inline-block;text-decoration:none;-webkit-animation-name:tooltip-appear;animation-name:tooltip-appear;-webkit-animation-duration:.1s;animation-duration:.1s;-webkit-animation-fill-mode:forwards;animation-fill-mode:forwards;-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-animation-delay:.4s;animation-delay:.4s}.tooltipped-no-delay:hover::before,.tooltipped-no-delay:hover::after,.tooltipped-no-delay:active::before,.tooltipped-no-delay:active::after,.tooltipped-no-delay:focus::before,.tooltipped-no-delay:focus::after{opacity:1;-webkit-animation:none;animation:none}.tooltipped-multiline:hover::after,.tooltipped-multiline:active::after,.tooltipped-multiline:focus::after{display:table-cell}.tooltipped-s::after,.tooltipped-se::after,.tooltipped-sw::after{top:100%;right:50%;margin-top:5px}.tooltipped-s::before,.tooltipped-se::before,.tooltipped-sw::before{top:auto;right:50%;bottom:-5px;margin-right:-5px;border-bottom-color:rgba(27,31,35,0.8)}.tooltipped-se::after{right:auto;left:50%;margin-left:-15px}.tooltipped-sw::after{margin-right:-15px}.tooltipped-n::after,.tooltipped-ne::after,.tooltipped-nw::after{right:50%;bottom:100%;margin-bottom:5px}.tooltipped-n::before,.tooltipped-ne::before,.tooltipped-nw::before{top:-5px;right:50%;bottom:auto;margin-right:-5px;border-top-color:rgba(27,31,35,0.8)}.tooltipped-ne::after{right:auto;left:50%;margin-left:-15px}.tooltipped-nw::after{margin-right:-15px}.tooltipped-s::after,.tooltipped-n::after{-webkit-transform:translateX(50%);transform:translateX(50%)}.tooltipped-w::after{right:100%;bottom:50%;margin-right:5px;-webkit-transform:translateY(50%);transform:translateY(50%)}.tooltipped-w::before{top:50%;bottom:50%;left:-5px;margin-top:-5px;border-left-color:rgba(27,31,35,0.8)}.tooltipped-e::after{bottom:50%;left:100%;margin-left:5px;-webkit-transform:translateY(50%);transform:translateY(50%)}.tooltipped-e::before{top:50%;right:-5px;bottom:50%;margin-top:-5px;border-right-color:rgba(27,31,35,0.8)}.tooltipped-multiline::after{width:-webkit-max-content;width:-moz-max-content;width:max-content;max-width:250px;word-wrap:break-word;white-space:pre-line;border-collapse:separate}.tooltipped-multiline.tooltipped-s::after,.tooltipped-multiline.tooltipped-n::after{right:auto;left:50%;-webkit-transform:translateX(-50%);transform:translateX(-50%)}.tooltipped-multiline.tooltipped-w::after,.tooltipped-multiline.tooltipped-e::after{right:100%}@media screen and (min-width: 0\\0){.tooltipped-multiline::after{width:250px}}.tooltipped-sticky::before,.tooltipped-sticky::after{display:inline-block}.tooltipped-sticky.tooltipped-multiline::after{display:table-cell}@media only screen and (-webkit-min-device-pixel-ratio: 2), only screen and (min--moz-device-pixel-ratio: 2), only screen and (-moz-min-device-pixel-ratio: 2), only screen and (min-device-pixel-ratio: 2), only screen and (min-resolution: 192dpi), only screen and (min-resolution: 2dppx){.tooltipped-w::after{margin-right:4.5px}}\n
            .brandsSelect {
                margin-left: 20px;
                height: 28px;
                -webkit-appearance: menulist;
                position: relative;
            }
            .brandsSelect::after {
                content: '';
                position: absolute;
                border: 5px solid transparent;
                border-bottom-color: #455A64;
                right: 5px;
                top: calc(50% - 5px);
            }`;
    document.getElementsByTagName('head')[0].appendChild(style);
})();
