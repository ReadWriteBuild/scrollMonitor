import { isOnServer, isInBrowser } from './constants';
import Watcher from './watcher';

function getViewportHeight (element) {
	if (isOnServer) {
		return 0;
	}
	if (element === document.body) {
		return window.innerHeight || document.documentElement.clientHeight;
	} else {
		return element.clientHeight;
	}
}

function getContentHeight (element) {
	if (isOnServer) {
		return 0;
	}

	if (element === document.body) {
		// jQuery approach
		// whichever is greatest
		return Math.max(
			document.body.scrollHeight, document.documentElement.scrollHeight,
			document.body.offsetHeight, document.documentElement.offsetHeight,
			document.documentElement.clientHeight
		);
	} else {
		return element.scrollHeight;
	}
}

function scrollTop (element) {
	if (isOnServer) {
		return 0;
	}
	if (element === document.body) {
		return window.pageYOffset ||
			(document.documentElement && document.documentElement.scrollTop) ||
			document.body.scrollTop;
	} else {
		return element.scrollTop;
	}
}


class RootItem {
	constructor (item) {
		this.item = item;
		this.watchers = [];
		this.viewportTop = null;
		this.viewportBottom = null;
		this.documentHeight = getContentHeight(item);
		this.viewportHeight = getViewportHeight(item);
		this.DOMListener = this.DOMListener.bind(this);

		var previousDocumentHeight;

		var calculateViewportI;
		function calculateViewport() {
			root.viewportTop = scrollTop(item);
			root.viewportBottom = root.viewportTop + root.viewportHeight;
			root.documentHeight = getContentHeight(item);
			if (root.documentHeight !== previousDocumentHeight) {
				calculateViewportI = this.watchers.length;
				while( calculateViewportI-- ) {
					this.watchers[calculateViewportI].recalculateLocation();
				}
				previousDocumentHeight = root.documentHeight;
			}
		}

		var updateAndTriggerWatchersI;
		function updateAndTriggerWatchers() {
			// update all watchers then trigger the events so one can rely on another being up to date.
			updateAndTriggerWatchersI = this.watchers.length;
			while( updateAndTriggerWatchersI-- ) {
				this.watchers[updateAndTriggerWatchersI].update();
			}

			updateAndTriggerWatchersI = this.watchers.length;
			while( updateAndTriggerWatchersI-- ) {
				this.watchers[updateAndTriggerWatchersI].triggerCallbacks();
			}

		}

		function recalculateWatchLocationsAndTrigger() {
			root.viewportHeight = getViewportHeight();
			calculateViewport();
			updateAndTriggerWatchers();
		}

		var recalculateAndTriggerTimer;
		function debouncedRecalcuateAndTrigger() {
			clearTimeout(recalculateAndTriggerTimer);
			recalculateAndTriggerTimer = setTimeout( recalculateWatchLocationsAndTrigger, 100 );
		}

		root.beget = root.create = function( element, offsets ) {
			if (typeof element === 'string') {
				element = document.querySelector(element);
			} else if (element && element.length > 0) {
				element = element[0];
			}

			var watcher = new ElementWatcher( element, offsets );
			watchers.push(watcher);
			watcher.update();
			return watcher;
		};

		root.update = function() {
			latestEvent = null;
			calculateViewport();
			updateAndTriggerWatchers();
		};
		root.recalculateLocations = function() {
			root.documentHeight = 0;
			root.update();
		};

	}

	listenToDOM () {
		if (isInBrowser) {
			if (window.addEventListener) {
				if (this.item === document.body) {
					window.addEventListener('scroll', this.DOMListener);
				} else {
					this.item.addEventListener('scroll', this.DOMListener);
				}
				window.addEventListener('resize', this.DOMListener);
			} else {
				// Old IE support
				if (this.item === document.body) {
					window.attachEvent('onscroll', this.DOMListener);
				} else {
					this.item.attachEvent('onscroll', this.DOMListener);
				}
				window.attachEvent('onresize', this.DOMListener);
			}
			this.destroy = function () {
				if (window.addEventListener) {
					if (this.item === document.body) {
						window.removeEventListener('scroll', this.DOMListener);
						this.rootWatcher.destroy();
					} else {
						this.item.removeEventListener('scroll', this.DOMListener);
					}
					window.removeEventListener('resize', this.DOMListener);
				} else {
					// Old IE support
					if (this.item === document.body) {
						window.detachEvent('onscroll', this.DOMListener);
						this.rootWatcher.destroy();
					} else {
						this.item.detachEvent('onscroll', this.DOMListener);
					}
					window.detachEvent('onresize', this.DOMListener);
				}
			};
		}
	}

	destroy () {
		// noop, override for your own purposes.
		// in listenToDOM, for example.
	}

	DOMListener (event) {
		this.setStateFromDOM(event);
		this.updateAndTriggerWatchers(event);
	}

	setStateFromDOM (event) {
		var viewportTop = scrollTop(this.item);
		var viewportHeight = getViewportHeight(this.item);
		var contentHeight = getContentHeight(this.item);

		this.setState(viewportTop, viewportHeight, contentHeight, event);
	}

	setState (newViewportTop, newViewportHeight, newContentHeight, event) {
		var needsRecalcuate = (newViewportHeight !== this.viewportHeight || newContentHeight !== this.contentHeight);

		this.viewportTop = newViewportTop;
		this.viewportHeight = newViewportHeight;
		this.viewportBottom = newViewportTop + newViewportHeight;
		this.contentHeight = newContentHeight;

		if (needsRecalcuate) {
			let i = this.watchers.length;
			while (i--) {
				this.watchers[i].recalculateLocation();
			}
		}
		this.updateAndTriggerWatchers(event);
	}

	updateAndTriggerWatchers (event) {
		let i = this.watchers.length;
		while (i--) {
			this.watchers[i].update();
		}

		i = this.watchers.length;
		while (i--) {
			this.watchers[i].triggerCallbacks(event);
		}
	}

	createCustomRoot () {
		return new RootItem();
	}

	createRoot (item) {
		if (typeof item === 'string') {
			item = document.querySelector(item);
		} else if (item && item.length > 0) {
			item = item[0];
		}
		this.rootWatcher = scrollMonitor.create(item);
		var root = new RootItem(item);
		root.setStateFromDOM();
		root.listenToDOM();
		return root;
	}

	create (item, offsets) {
		if (typeof item === 'string') {
			item = document.querySelector(item);
		} else if (item && item.length > 0) {
			item = item[0];
		}
		return new Watcher(this, item, offsets);
	}

	beget (item, offsets) {
		return this.create(item, offsets);
	}
}

var scrollMonitor = new RootItem(isOnServer ? null : document.body);
scrollMonitor.setStateFromDOM(null);
scrollMonitor.listenToDOM();

export default scrollMonitor;
