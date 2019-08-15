$(document).ready(function() {
  // Управление загрузкой кастомного шрифта
  function fontLoad() {
    if( sessionStorage.foutFontsLoaded ) {
      document.documentElement.className += " fonts-loaded";
      return;
    }

    var font = new FontFaceObserver('Roboto', {
      weight: 400,
      style: 'normal'
    });

    var fontBold = new FontFaceObserver('Roboto', {
      weight: 700,
      style: 'normal'
    });

    var fontItalic = new FontFaceObserver('Roboto', {
      weight: 400,
      style: 'italic'
    });

    var fontBoldItalic = new FontFaceObserver('Roboto', {
      weight: 700,
      style: 'italic'
    });

    var fontCondensedRegular = new FontFaceObserver('Roboto Condensed', {
      weight: 400,
      style: 'normal'
    });

    var fontCondensedBold = new FontFaceObserver('Roboto Condensed', {
      weight: 700,
      style: 'normal'
    });

    Promise.all([font.load(), fontBold.load(), fontItalic.load(), fontBoldItalic.load(), fontCondensedRegular.load(), fontCondensedBold.load()]).then(function () {
      document.documentElement.className += " fonts-loaded";

      sessionStorage.foutFontsLoaded = true;
    });
  }

  fontLoad();


  // Кроссбраузерная поддержка svg спрайтов
  svg4everybody();


	$('.js-select').select2({
  		minimumResultsForSearch: Infinity
  });

  $('.js-lp-region-select').select2({
      minimumResultsForSearch: Infinity,
      theme: 'lp-region-select'
  });
});


var Accordeon = {
	el: '.js-accordeon',
	name: "Accordeon",

	initialize: function () {
		this.answer = this.$(".js-accordeon__answer");
		this.currentQuestion = this.$(".js-accordeon__question");
		this.answer.not(this.currentQuestion.filter('.accordeon__question--rotate').next()).hide();
	},

	events: {
		'click .js-accordeon__question': 'accordeonItemSwitch'
	},

	accordeonItemSwitch: function (evt) {
		this.currentAnswer = $(evt.currentTarget).next();
		this.answer.not(this.currentAnswer).slideUp();
		this.currentAnswer.slideToggle(600);
		$(evt.currentTarget).toggleClass('accordeon__question--rotate');
		this.currentQuestion.not($(evt.currentTarget)).removeClass('accordeon__question--rotate');
	}
};
App.Control.install(Accordeon);

var BackToTopLp = {
    el: '.js-back-to-top-lp',
    name: 'BackToTopLp',
    initialize: function() {

    },

    events: {
        'click': 'scrollToTop'
    },

    scrollToTop: function(ev) {
        ev.preventDefault();

        $('html, body').animate({
            scrollTop: 0
        }, 1800);
    }
};

App.Control.install(BackToTopLp);
var BackToTop = {
    el: '.js-back-to-top',
    name: 'BackToTop',
    initialize: function() {
        this.offset = 600;
        this.backToTopBtn = this.$('.js-back-to-top__btn');

        var self = this;

        $(window).bind('scroll', function () {
            self.fadeIn();
        });
    },

    events: {
        'click .js-back-to-top__btn': 'scrollToTop'
    },

    scrollToTop: function(ev) {
        ev.preventDefault();

        $('html, body').animate({
            scrollTop: 0
        }, 1800);
    },

    fadeIn: function() {
        if($(window).scrollTop() > this.offset) {
            this.$el.find('.buttons-round__right').removeClass('buttons-round--hidden');
        } else {
			this.$el.find('.buttons-round__right').addClass('buttons-round--hidden');
        }
    }
};

App.Control.install(BackToTop);
var ClientsSlider = {
	el: '.js-content-slider-lp',
	name: 'ClientsSlider',

	initialize: function () {
		this.$el.bxSlider({
			slideMargin: 20,
			adaptiveHeight: true,
			infiniteLoop: true
		});
	}

};

App.Control.install(ClientsSlider);

App.Control.install({
	el: '.js-dotted-nav-slider',
	name: 'DottedNavSlider',
	initialize: function () {
		var self = this;
		$(window).bind('load', function () {
			var isTouch = self.checkTouch();
			self.initSlider(isTouch);
		});

	},
	checkTouch: function () {
		var isTouchDevice = "ontouchstart" in window;
		return isTouchDevice;
	},
	initSlider: function (isTouch) {
		var sliderOpts = {
			controls: false,
			slideWidth: 706,
			minSlides: 1,
			maxSlides: 1,
			adaptiveHeight: true,
			touchEnabled: isTouch
		};

		if (!_.isUndefined(this.$el.data('auto'))) {
			sliderOpts.auto = true;
			sliderOpts.stopAutoOnClick = true;
		}

		this.$el.bxSlider(sliderOpts);
	}
});

var EqualHeight = {
	el: '.js-equal-height',
	name: 'EqualHeight',

	initialize: function () {
		this.block = this.$('.js-equal-height__block');
		this.img = this.$('img');

		var self = this;

		self.setEqualHeight();
		$(window).bind('load', function () {
			self.setEqualHeight();
		});

		this.img.bind('load', function () {
			self.setEqualHeight();
		});

		$(window).bind('resize', function () {
			self.setEqualHeight();
		});
	},

	setEqualHeight: function () {
		var maxHeight = 0;
		var isActive;

		this.block.css('height', 'auto');

		this.block.each(function (index) {
			var blockHeight = parseInt($(this).outerHeight());

			if ($(this).data('active')) {
				isActive = true;
			}

			if (blockHeight > maxHeight) {
				maxHeight = blockHeight;
			}
		});

		 this.block.css('height', maxHeight);

		if (isActive) {
			var newMaxHeight = maxHeight + 20;
			this.block.filter('[data-active]').css('height', newMaxHeight);
		}
		if ($(window).outerWidth() < 768 && this.block.hasClass('js-equal-height__block--fix-adaptive')) {
			this.block.css('height', 'auto');
		}
	}
};

App.Control.install(EqualHeight);

var ExpertsBlock = {
	el: '.js-experts-block',
	name: 'ExpertsBlock',
	initialize: function () {
		this.activeExpert = this.$('.js-experts-active');
		this.btn = this.$('.js-experts-block__btn');
		this.activeExpertIndex = this.activeExpert.index();
		this.expertSections = this.$('.js-experts-block__section');
		this.expertSections.eq(this.activeExpertIndex).addClass('is-active');
	},
	events: {
		'click .js-experts-block__btn': 'activeExperts'
	},
	activeExperts: function (evt) {
		var target = $(evt.currentTarget);
		this.targetId = target.data('id');
		this.btn.removeClass('is-active js-experts-active');
		target.addClass('is-active js-experts-active');
		this.expertSections.removeClass('is-active');
		$('#' + this.targetId).addClass('is-active');
	}
};

App.Control.install(ExpertsBlock);

App.Control.install({
	el: '.js-fancy-media',
	name: 'FancyMedia',
	initialize: function () {
		var self = this;
		if (this.$el.is('[data-fullscreen]')) {
			this.padding = 0;
		} else {
			this.padding = 15;
		}
		var fitToView = this.$el.data('fullsize') ? false : true;
		this.$el.fancybox({
			wrapCSS: 'fancy-media',
			margin: ($(window).width() > 937) ? 20 : 5,
			fitToView: fitToView,
			padding: self.padding,
			autoResize: true,
			maxWidth: '100%',
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(27, 71, 105, 0.7)'
					}
				}
			}
		});
	}
});


App.Control.install({
	el: '.js-fancy-modal',
	name: 'FancyModal',
	initialize: function () {
		var self = this;
		this.$el.fancybox({
			wrapCSS: 'fancy-modal',
			margin: ($(window).width() > 937) ? 20 : 5,
			fitToView: false,
			padding: 0,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(27, 71, 105, 0.7)'
					}
				}
			}
		});
	}
});


App.Control.install({
	el: '.js-fancy-modal-lp',
	name: 'FancyModalLp',
	breakpoint: 768,
	initialize: function () {
		var self = this;

		if ($(window).width() >= this.breakpoint) {
			this.ratio = 0.5;
		} else {
			this.ratio = 0.15;
		}

		this.$el.fancybox({
			wrapCSS: 'fancy-modal-lp',
			padding: 0,
			margin: ($(window).width() > 937) ? 20 : 10,
			width: '100%',
			maxWidth: 610,
			height: 'auto',
			autoSize: false,
			fitToView: false,
			topRatio: self.ratio,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(34, 44, 72, 0.5)'
					}
				}
			}
		});
	}
});


App.Control.install({
	el: '.js-fancy-modal-lp-lg',
	name: 'FancyModalLpLg',
	breakpoint: 768,
	initialize: function () {
		var self = this;

		this.$el.fancybox({
			wrapCSS: 'fancy-modal-lp-lg',
			padding: 0,
			margin: ($(window).width() > 937) ? 20 : 10,
			width: '100%',
			maxWidth: 1030,
			height: 'auto',
			autoSize: false,
			fitToView: false,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(255,255,255)'
					}
				}
			},
			afterShow: function () {
				$(".fancybox-overlay").addClass("fancy-modal-lp-lg-overlay");
			}
		});
	}
});



App.Control.install({
	el: '.js-fancy-modal-lp-sm',
	name: 'FancyModalLpSmall',
	breakpoint: 768,
	initialize: function () {
		var self = this;

		if ($(window).width() >= this.breakpoint) {
			this.ratio = 0.5;
		} else {
			this.ratio = 0.15;
		}

		this.fancyPopup = this.$el.fancybox({
			wrapCSS: 'fancy-modal-lp-sm',
			padding: 0,
			margin: ($(window).width() > 937) ? 20 : 10,
			width: '100%',
			maxWidth: 400,
			height: 'auto',
			autoSize: false,
			fitToView: false,
			topRatio: self.ratio,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(34, 44, 72, 0.5)'
					}
				}
			}
		});
	}
});

App.Control.install({
	el: '.js-fancy-reviews-text',
	name: 'FancyReviewsTextModal',
	initialize: function () {
		var self = this;
		this.$el.fancybox({
			wrapCSS: 'fancy-reviews-text',
			margin: ($(window).width() > 937) ? 20 : 5,
			fitToView: false,
			padding: 20,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(27, 71, 105, 0.7)'
					}
				}
			}
		});
	}
});

App.Control.install({
	el: '.js-big-modal',
	name: 'FancyBigModal',
	initialize: function () {
		var self = this;
		this.$el.fancybox({
			wrapCSS: 'fancy-big-modal',
			margin: ($(window).width() > 937) ? 20 : 5,
			fitToView: false,
			padding: 20,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(27, 71, 105, 0.7)'
					}
				}
			}
		});
	}
});


App.Control.install({
	el: '.js-fancy-text',
	name: 'FancyTextModal',
	initialize: function () {
		var self = this;
		this.$el.fancybox({
			wrapCSS: 'fancy-content',
			margin: ($(window).width() > 937) ? 20 : 5,
			fitToView: false,
			padding: 0,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(27, 71, 105, 0.7)'
					}
				}
			}
		});
	}
});


App.Control.install({
	el: '.js-lg-modal',
	name: 'FancyLgModal',
	initialize: function () {
		var self = this;
		this.$el.fancybox({
			wrapCSS: 'fancy-lg-modal',
			margin: ($(window).width() > 937) ? 20 : 5,
			fitToView: false,
			padding: 0,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(27, 71, 105, 0.7)'
					}
				}
			}
		});
	}
});


App.Control.install({
	el: '.js-fancy-modal-sm',
	name: 'FancyModalSmall',
	breakpoint: 768,
	wrapCss: 'fancy-modal-sm',
	maxWidth: 340,
	padding:0,
	initialize: function () {
		var self = this;
		if ($(window).width() >= this.breakpoint) {
			this.ratio = 0.5;
		} else {
			this.ratio = 0.15;
		}
		this.fancyPopup = this.$el.fancybox({
			wrapCSS: this.wrapCss,
			padding: self.padding,
			margin: ($(window).width() > 937) ? 20 : 10,
			width: '100%',
			maxWidth: this.maxWidth,
			height: 'auto',
			autoSize: false,
			fitToView: false,
			topRatio: self.ration,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(34, 44, 72, 0.5)'
					}
				}
			}
		});
	}
});


App.Control.extend('FancyModalSmall', {
	el: '.js-fancy-modal-sm-white',
	name: 'FancyModalSmallWhiteClose',
	wrapCss: 'fancy-modal-sm-white',
	maxWidth: 400
});

App.Control.install({
	el: '.js-fancy-modal-rd',
	name: 'FancyModalRd',
	breakpoint: 768,
	initialize: function () {
		var self = this;

		if ($(window).width() >= this.breakpoint) {
			this.ratio = 0.5;
		} else {
			this.ratio = 0.15;
		}

		this.$el.fancybox({
			wrapCSS: 'fancy-modal-rd',
			padding: 0,
			margin: ($(window).width() > 937) ? 20 : 10,
			width: '100%',
			maxWidth: 860,
			height: 'auto',
			autoSize: false,
			fitToView: false,
			topRatio: self.ratio,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(34, 44, 72, 0.5)'
					}
				}
			}
		});
	}
});

App.Control.install({
	el: '.js-form',
	name: 'FormFabric',

	/**
	 * Submit button selector
	 */
	submitButton: '.js-form-submit',

	/**
	 * Options for Parsley.js validation plugin
	 */
	parsleyValidateOpts: {
		errorsMessagesDisabled: true,
		errorClass: '_error',
		successClass: '_success',
		classHandler: function (el) {
			return el.$element.next(".select2");
		}
	},

	$validateFalseFields: null,


	/**
	 * Get control of form
	 */
	initialize: function () {

		/**
		 * UI elements initialization...
		 */

		this.$('.js-select-editable').select2({
			minimumResultsForSearch: Infinity,
			theme: 'editable'
		});

		this.$('.js-form-select').select2({
			minimumResultsForSearch: Infinity,
			theme: 'form-select'
		});

		this.$('.js-form-select-trademark').select2({
			minimumResultsForSearch: Infinity,
			theme: 'form-select form-trademark'
		});


		// Select2 внутри fancybox работает некорректно, так как z-index fancybox больше.
		// Инициализируем плагин с дополнительным классом form-select-in-modal
		// для задания нужного z-index выпадающему списку
		this.$('.js-form-select-in-modal').select2({
			minimumResultsForSearch: Infinity,
			theme: 'form-select form-select-in-modal'
		});

		/**
		 * Check and find UI interactive fields
		 */

		this.multiSelectInputs = this.$el.find('.js-form-multiselect');
		this.choiseRadioContent = this.$el.find('.js-form-radio-choise');
		this.choiseTabsContent = this.$el.find('.js-form-tabs-changer');
		this.privacyAgree = this.$el.find('.js-form-privacy-agree');

		/**
		 * More UI elements initialization...
		 */

		if (this.choiseRadioContent)
			this.initRadioChoisingControl();

		if (this.choiseTabsContent)
			this.initTabsContentControl();

		if (this.privacyAgree)
			this.initPrivacyAgree();

		if (this.multiSelectInputs)
			this.initMultiSelectControl();

		if (this.$el.hasClass('js-form-hide-btn'))
			this.hideContactsBtn();

		/**
		 * Add masks and validation rules for phone fields
		 */

		this.$el.find('input[type=\'tel\']').inputmask({
			alias: 'phoneru'
		});
		this.$el.find('input[type=\'tel\']').parsley({
			phone: ''
		});

		/**
		 * Submit by button click event handler
		 */

		if (_.isElement(this.$el.find(this.submitButton)[0]))
			this.$el.find(this.submitButton).on('click', this.$el, _.bind(this.submitProcess, this));

		/**
		 * Get URL to send
		 */
		this.gateway = this.buildGatewayPath();

		this.$validateFalseFields = $([]);
	},


	/**
	 * Action url definition
	 *
	 * @returns {URI}
	 */
	buildGatewayPath: function () {

		if (this.$el.data('gateway'))
			var uri = new URI(this.$el.data('gateway'));
		else
			var uri = new URI();

		uri
			.setSearch('AJAX', 'Y')
			.toString();
		return uri;
	},

	/**
	 * Vaidate active fields by Parsley.js
	 *
	 * @param $arInputs
	 * @returns {boolean}
	 */
	validateForm: function ($arInputs) {
		if (_.isEmpty(this.$el.data('novalidate'))) {
			var self = this,
				result = true,
				fieldInstance, fieldResult;

			this.$validateFalseFields = $([]);

			$arInputs.each(function (index, value) {

				var $field = $(this);

				fieldInstance = $field.parsley(self.parsleyValidateOpts);

				fieldInstance.off('field:success');
				fieldInstance.off('field:error');

				fieldInstance.on('field:success', function () {

					self.$validateFalseFields = self.$validateFalseFields.not($field);

					self.checkValidateState();

				});

				fieldInstance.on('field:error', function () {

					if (!self.$validateFalseFields.filter($field).length)
						self.$validateFalseFields.push($field.get()[0]);

					self.checkValidateState();

				});

				fieldResult = fieldInstance.validate();

				if (_.isBoolean(fieldResult) && fieldResult === true) {
					_.noop();
				} else {
					result = false;
				}

			});
			return result;
		} else
			return true;
	},

	/**
	 * Send button class control
	 */
	checkValidateState: function () {

		if (this.$validateFalseFields.length) {
			this.$el.find(this.submitButton).addClass('_disabled');
		} else {
			this.$el.find(this.submitButton).removeClass('_disabled');
		}

	},

	/**
	 * Submit initial function
	 *
	 * @param event
	 */
	submitProcess: function (event) {
		var $initedInputs = this.collectInitedInputs();
		if (this.validateForm($initedInputs)) {
			this.waitingStateOn();
			this.submitData($initedInputs);
		}
	},

	/**
	 * Request handler
	 *
	 * @param $initedInputs
	 */
	submitData: function ($initedInputs) {

		var self = this;

		$.ajax({
			url: self.gateway,
			data: self.formData($initedInputs),
			processData: false,
			contentType: false,
			type: 'POST'
		}).always(function (data, status, xhr) {
			self.afterSubmitSuccess(data, xhr);
		});

	},

	/**
	 * Simple request callback
	 *
	 * @param data
	 * @param xhr
	 */
	afterSubmitSuccess: function (data, xhr) {
		this.waitingStateOff();
	},

	/**
	 * Active fields collector
	 *
	 * @returns {$()}
	 */
	collectInitedInputs: function () {

		var $formInputs, $tmpInputs;

		$tmpInputs = this.$el.find(':input').not('button');

		$formInputs = $tmpInputs.filter(':visible')
			.add(this.$el.find('.input-file').filter(':visible').find(':file'))
			.add(this.$el.find('.input-multifile').filter(':visible').find(':file'))
			.add($tmpInputs.filter('input[type=hidden]'))
			.add($tmpInputs.filter('[data-mustvalidate]'));

		return $formInputs;
	},

	/**
	 * Form data object constructor
	 *
	 * @param $initedInputs
	 * @returns FormData
	 */
	formData: function ($initedInputs) {

		var $dinamicForm = $(document.createElement('form'));

		$initedInputs.each(function () {
			var $_cloneInput = $($(this).clone());
			if ($_cloneInput.is('select'))
				$_cloneInput.val($(this).val());
			$_cloneInput.appendTo($dinamicForm);
		});

		return new FormData($dinamicForm[0]);
	},

	/**
	 * Waiting states...
	 */

	waitingStateOn: function () {
		$(document.createElement('div')).addClass('ui-loader').prependTo(this.$el);
	},
	waitingStateOff: function () {
		this.$el.find('.ui-loader').remove();
	},

	/**
	 * UI controls initialises...
	 */

	initMultiSelectControl: function () {
		var self = this;
		_.each(this.multiSelectInputs, function (multiSelect) {

			$multiSelect = $(multiSelect);

			var emptyText = !_.isEmpty($multiSelect.data('emptyText')) ? $multiSelect.data('emptyText') : 'Ничго не выбрано';

			this.$('.js-form-multiselect').selectpicker({
				selectedTextFormat: 'count > 2',
				selectOnTab: true,
				noneSelectedText: emptyText
			});

		});
	},

	initPrivacyAgree: function () {
		var self = this;
		this.privacyAgree.find('.js-form-privacy-agree-responsive-btn').on('click', function () {
			self.privacyAgree.find('.js-form-privacy-agree-full').removeClass('hide-up-to-md hide-xs');
			self.privacyAgree.find('.js-form-privacy-agree-short').hide(0);
		});

		this.privacyAgree.find('.js-form-privacy-agree-close-btn').on('click', function () {
			self.privacyAgree.find('.js-form-privacy-agree-full').addClass('hide-xs');
			self.privacyAgree.find('.js-form-privacy-agree-short').show(0);
		});
	},

	hideContactsBtn: function () {
		var self = this;
		var isInputFocus = false;
		var isBtnHidden = false;
		this.formInputs = self.$el.find('[data-attribute]');
		self.formInputs.on('focus', function (evt) {
			isInputFocus = true;
			this.dataTarget = $(evt.currentTarget).attr('data-attribute');
			if (!isBtnHidden) {
				$('[data-target=' + this.dataTarget + ']').hide(300);
				isBtnHidden = true;
			}
		});
		self.formInputs.on('blur', function (evt) {
			isInputFocus = false;
			var self = this;
			this.dataTarget = $(evt.currentTarget).attr('data-attribute');
			if (isBtnHidden) {
				setTimeout(function () {
					if (!isInputFocus) {
						$('[data-target=' + self.dataTarget + ']').show(300);
						isBtnHidden = false;
					}

				}, 5000);
			}
		});
	},

	initTabsContentControl: function () {
		var self = this;
		_.each(this.choiseTabsContent, function (tabsContent) {
			$tabsContent = $(tabsContent);
			$controlBtns = $tabsContent.find('.js-form-tabs-changer-btns')
				.find('span');
			$controlTabs = $tabsContent.find('.js-form-tabs-changer-content')
				.find('.js-form-tabs-changer-block');

			$controlTabs.hide(0);

			if ($controlBtns.length > 0) {
				$activeBtn = $controlBtns.eq(0);
				$controlBtns.not($activeBtn)
					.addClass('dotted cur-pointer');
				$activeTab = $controlTabs.eq(0);
				$activeTab.show(0);
			}

			$controlBtns.on('click', function () {
				self.contentTabChange($(this));
			});
		});
	},

	contentTabChange: function ($el) {
		$tabsContent = $el.closest('.js-form-tabs-changer');
		$controlBtns = $tabsContent.find('.js-form-tabs-changer-btns')
			.find('span');
		$controlTabs = $tabsContent.find('.js-form-tabs-changer-content')
			.find('.js-form-tabs-changer-block');

		$el.removeClass('dotted cur-pointer');
		$tab2Show = $controlTabs.eq($controlBtns.index($el));
		$controlTabs.not($tab2Show)
			.hide(0);
		$tab2Show.show(0);
		$controlBtns.not($el)
			.addClass('dotted cur-pointer');
	},

	initRadioChoisingControl: function () {
		var self = this;
		_.each(this.choiseRadioContent, function (radioCollection) {
			$control = $(radioCollection);
			$controlRadios = $control.find('input[type="radio"]');
			$controledBlocks = $controlled = self.findClosestChoisingBlock($control)
				.find('.js-form-radio-content-block');
			$controledBlocks.hide(0);
			$activeRadioOpt = $controlRadios.filter(':checked');
			if ($activeRadioOpt) {
				$activeOptIndex = $controlRadios.index($activeRadioOpt);
				if ($activeOptIndex >= 0) {
					$controledBlocks.eq($activeOptIndex)
						.show(0);
				}
			}
			$controlRadios.on('click', function () {
				self.choisingBlockChange($(this));
			});
		});
	},

	choisingBlockChange: function ($el) {
		$control = $el.closest('.js-form-radio-choise');
		$controledBlocks = this.findClosestChoisingBlock($control)
			.find('.js-form-radio-content-block');
		$block2Show = $controledBlocks.eq($control.find('input[type="radio"]')
			.index($el));
		$controledBlocks.not($block2Show)
			.hide(0);
		$block2Show.show(0);
	},

	findClosestChoisingBlock: function ($el) {
		if ($el.parent().length > 0) {
			$findRes = $el.parent()
				.find('.js-form-radio-content');
			if ($findRes.length > 0) {
				return $($findRes[0]);
			} else {
				return this.findClosestChoisingBlock($el.parent());
			}
		} else
			return $();
	}
});

App.Control.extend('FormFabric', {
	el: '.js-form-lp',
	name: 'FormFabricLP',

	/**
	 * Get control of form
	 */
	initialize: function () {

		/**
		 * Check and find UI interactive fields
		 */

		this.textInputs = this.$el.find('.form-lp-input--text');
		this.fileInputs = this.$el.find('.form-lp-input--file');

		/**
		 * More UI elements initialization...
		 */

		/*if (this.textInputs)
			this.initTextInputControl();*/

		if (this.fileInputs)
			this.initFileInputControl();

		/**
		 * Add masks and validation rules for phone fields
		 */

		this.$('.js-select-lp').select2({
			theme: 'form-select form-select-lp',
			minimumResultsForSearch: Infinity


		});


		this.$el.find('input[type=\'tel\']').inputmask({
			alias: 'phoneru'
		});
		this.$el.find('input[type=\'tel\']').parsley({
			phone: ''
		});
		this.$el.find('input[data-mustchecked=\'data-mustchecked\']').parsley({
			mustchecked: '',
			multiple: this.cid
		});

		/**
		 * Submit by button click event handler
		 */

		if (_.isElement(this.$el.find(this.submitButton)[0]))
			this.$el.find(this.submitButton).on('click', this.$el, _.bind(this.submitProcess, this));

		/**
		 * Get URL to send
		 */
		this.gateway = this.buildGatewayPath();

		this.$validateFalseFields = $([]);
	},

	/**
	 * UI controls initialises...
	 */

	initTextInputControl: function () {
		var self = this;
		_.each(this.textInputs, function (textInput) {

			$(textInput).find('input').mouseenter(function () {
				$(this).addClass('_hide-label');
			}).mouseleave(function () {
				if (_.isEmpty($(this).val()))
					$(this).removeClass('_hide-label');
			}).focusout(function () {
				if (!$(this).val())
					$(this).removeClass('_hide-label');
			});

		});
	},

	initFileInputControl: function () {
		var self = this;
		_.each(this.fileInputs, function (fileInput) {

			var $textInput = $(fileInput).find('input[type="text"]');

			$(fileInput).find('input[type="file"]').change(function () {
				$textInput.val($(this).val().replace(/.*\\/, "")).trigger('change');
			});

		});
	}

});

App.Control.install({
    el: '.js-full-width-gallery',
    name: 'fullWidthSlider',
    initialize: function () {
        var settingsHandler = function() {
            var sliderOptsDesktop = {
                slideWidth  : 820,
                minSlides   : 2,
                maxSlides   : 3,
                moveSlides  : 1,
                prevText    : '',
                nextText    : '',
                pager       : false,
                auto        : true
            };
            var sliderOptsMobile = {
                maxSlides   : 1,
                moveSlides  : 1,
                controls    : false,
                pager       : true
            };

            return ($(window).width() <= 767 ) ? sliderOptsMobile : sliderOptsDesktop;
        };

        var gallery;

        function enableGallery() {
            gallery.reloadSlider(settingsHandler());
        }

        gallery = this.$el.bxSlider(settingsHandler());
        $(window).on('resize', enableGallery);
    }
});
var ExpertSliderRd = {
	el: '.js-logos-slider',
	name: 'ExpertSliderRd',
	breakpoint: 768,
	slider: null,
	scroll: null,
	elementsCount: 0,

	initialize: function () {
		var self = this;
		this.logosSlide = this.$('.js-logos-slider__slide');
		this.removedElement = this.logosSlide.not(":eq(0)");

		this.renderMode();

		$(window).bind('resize', function () {
			self.renderMode();
		});
	},

	renderMode: function () {
		var self = this;

		if ($(window).outerWidth() < self.breakpoint) {
			this.removedElement.detach();
			self.destroySlider();
		} else {
			this.$el.append(this.removedElement);
			self.initSlider();
		}
	},

	initSlider: function () {
		if (!this.slider) {
			this.slider = this.$el.bxSlider({
			});
		}
	},

	destroySlider: function () {
		if (this.slider) {
			this.slider.destroySlider();
			this.slider = null;
		}
	}
};

App.Control.install(ExpertSliderRd);

var MainOfficeMap = {
    el: '#main-office',
    name: 'MainOfficeMap',
    initialize: function () {
        if (!_.isUndefined(window.ymaps)) {
            ymaps.ready(init);
            var myMap;

            function init() {
                myMap = new ymaps.Map("main-office", {
                    center: [55.718324068999664, 37.79198949999998],
                    zoom: 15,
                    controls: ['zoomControl']
                });

                myPlacemark = new ymaps.Placemark([55.718324068999664, 37.79198949999998], {
                    iconCaption: 'Рязанский проспект, 75к4'
                }, {
                    preset: 'islands#redDotIconWithCaption',
                });

                myMap.geoObjects.add(myPlacemark);
            }
        }
    }
};

App.Control.install(MainOfficeMap);


var MainOfficeMapMoscow = {
    el: '#main-office-moscow',
    name: 'MainOfficeMapMoscow',
    initialize: function () {
        if (!_.isUndefined(window.ymaps)) {
            ymaps.ready(init);
            var myMap;

            function init() {
                myMap = new ymaps.Map("main-office-moscow", {
                    center: [55.718324068999664, 37.79198949999998],
                    zoom: 15,
                    controls: ['zoomControl']
                });

                myPlacemark2 = new ymaps.Placemark([55.718324068999664, 37.79198949999998], {
                    hintContent: '109456, Москва, Рязанский проспект, д.75, корп.4',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/local/images/map/icon-balloon.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-17, -33]
                });

                myMap.geoObjects.add(myPlacemark2);
            }
        }
    }
};

App.Control.install(MainOfficeMapMoscow);

var MainOfficeMapSaratov = {
    el: '#main-office-saratov',
    name: 'MainOfficeMapSaratov',
    initialize: function () {
        if (!_.isUndefined(window.ymaps)) {
            ymaps.ready(init);
            var myMap;

            function init() {
                myMap = new ymaps.Map("main-office-saratov", {
                    center: [51.532671, 46.039045],
                    zoom: 15,
                    controls: ['zoomControl']
                });

                myPlacemark2 = new ymaps.Placemark([51.532671, 46.039045], {
                    hintContent: '410031, Саратов, Московская улица, 55'
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '../../assets/images/icon-balloon-red.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-17, -33]
                });

                myMap.geoObjects.add(myPlacemark2);
            }
        }
    }
};

App.Control.install(MainOfficeMapSaratov);

var RegionalOfficesMap = {
    el: '#regional-offices',
    name: 'RegionalOfficesMap',
    initialize: function() {
        if (!_.isUndefined(window.ymaps)) {
            ymaps.ready(init);
            var myMap;

            function init() {
                myMap = new ymaps.Map("regional-offices", {
                    center: [54.404311668987056, 46.3975481875],
                    zoom: 5,
                    controls: ['zoomControl']
                });

                myPlacemark1 = new ymaps.Placemark([55.718324068999664, 37.79198949999998], {
                    hintContent: '109456, Москва, Рязанский проспект, д.75, корп.4',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/assets/images/icon-balloon--white.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-17, -33]
                });

                myPlacemark2 = new ymaps.Placemark([59.92901056417907, 30.38784099999998], {
                    hintContent: '191167, Санкт-Петербург, Синопская набережная 22, 4 этаж',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/assets/images/icon-balloon.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-15, -32]
                });

                myPlacemark3 = new ymaps.Placemark([56.83566256788385, 60.59089], {
                    hintContent: '620014, Екатеринбург, ул.Хохрякова, д.10',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/assets/images/icon-balloon.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-13, -32]
                });

                myPlacemark4 = new ymaps.Placemark([51.66437307230397, 39.19270549999995], {
                    hintContent: '394018, Воронеж, ул.Никитинская,д.42',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/assets/images/icon-balloon.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-13, -31]
                });

                myPlacemark5 = new ymaps.Placemark([56.323328068402155, 44.01145699999997], {
                    hintContent: '603006, Нижний Новгород, ул.Ковалихинская, д.8',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/assets/images/icon-balloon.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-14, -32]
                });

                myPlacemark6 = new ymaps.Placemark([57.63180206699096, 39.870699999999985], {
                    hintContent: '150040, Ярославль, ул.Некрасова, д.41',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/assets/images/icon-balloon.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-13, -31]
                });

                myPlacemark7 = new ymaps.Placemark([55.79008406894568, 49.11087849999998], {
                    hintContent: '420111, Казань, ул.Право-Булачная, д.35/2',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/assets/images/icon-balloon.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-14, -32]
                });

                myPlacemark8 = new ymaps.Placemark([51.53263757238977, 46.03906249999998], {
                    hintContent: '410031, Саратов, ул.Московская, 55',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/assets/images/icon-balloon.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-14, -32]
                });

                myPlacemark9 = new ymaps.Placemark([54.81712156985457, 56.077493499999946], {
                    hintContent: '450112, Уфа, ул.Первомайская, д.29',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/assets/images/icon-balloon.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-16, -28]
                });

                myPlacemark10 = new ymaps.Placemark([47.27147357427328, 39.761805999999986], {
                    hintContent: '344065, Ростов-на-Дону, ул.50-летия Ростсельмаша, 1/52',
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: '/assets/images/icon-balloon.png',
                    iconImageSize: [26, 33],
                    iconImageOffset: [-15, -30]
                });


                myMap.geoObjects
                    .add(myPlacemark1)
                    .add(myPlacemark2)
                    .add(myPlacemark3)
                    .add(myPlacemark4)
                    .add(myPlacemark5)
                    .add(myPlacemark6)
                    .add(myPlacemark7)
                    .add(myPlacemark8)
                    .add(myPlacemark9)
                    .add(myPlacemark10);
            }
        }
    }
};

App.Control.install(RegionalOfficesMap);
var PartiallyHidden = {
    el: '.js-partially-hidden',
    name: 'PartiallyHidden',

    initialize: function() {
        this.btn = this.$('.js-partially-hidden__btn');
        this.btnWrap = this.$('.js-partially-hidden__btn-wrap');
        this.hiddenBlock = this.$('.js-partially-hidden__block');
        this.hiddenContent = this.$('.js-partially-hidden__content');
        this.clicked = false;

        var self = this;

        $(window).bind('resize', function() {
            if(self.clicked) {
                self.hiddenContentHeight = self.hiddenContent.outerHeight();
                self.hiddenBlock.outerHeight(self.hiddenContentHeight);
            }
        });
    },

    events: {
        'click .js-partially-hidden__btn': 'showHiddenBlock'
    },

    showHiddenBlock: function(ev) {
        var self = this;
        this.clicked = true;

        this.$el.removeClass('is-hidden');
        this.hiddenContentHeight = this.hiddenContent.outerHeight();

        this.hiddenBlock.animate({
            height: this.hiddenContentHeight
        }, 500, function() {
            self.btnWrap.fadeOut(300);
        });
    }
};

App.Control.install(PartiallyHidden);
var PreviewPostMobileSlider = {
	el: '.js-preview-mobile-slider',
	name: 'PreviewPostMobileSlider',
	sliderSm: null,
	initialize: function () {

		var self = this;
		self.renderMode();

		$(window).bind('resize', function () {
			self.renderMode();
		});
	},
	renderMode: function () {
		var self = this;
		if ($(window).outerWidth() < 767) {
			self.initSmSlider();
		} else {
			self.destroySmSlider();
		}

	},

	initSmSlider: function () {
		if (!this.sliderSm) {
			this.sliderSm = this.$el.bxSlider({
				slideMargin: 20,
				adaptiveHeight: true,
				infiniteLoop: true
			});
		}
	},
	destroySmSlider: function () {
		if (this.sliderSm) {
			this.sliderSm.destroySlider();
			this.sliderSm = null;
		}
	}

};

App.Control.install(PreviewPostMobileSlider);

var PricesSliderBlocks = {
	el: '.js-prices-slider',
	name: 'PricesSliderBlocks',
	breakpoint: 991,
	slider: null,
	scroll: null,
	elementsCount: 0,

	initialize: function() {
		this.elementsCount = this.$el.find('').length;
		var self = this;

		this.renderMode();

		$(window).bind('resize', function() {
			self.renderMode();
		});
	},

	renderMode: function () {
		var self = this;

		if($(window).outerWidth() > self.breakpoint) {
			self.destroySlider();
		} else {
			self.initSlider();
		}
	},

	initSlider: function() {
		if(!this.slider) {
			this.slider = this.$el.bxSlider({
				pager: false,
				slideWidth: 400,
				slideMargin: 30,
				minSlides: 1,
				maxSlides: 1,
				infiniteLoop: true,
				startSlide: 1
			});
		}
	},

	destroySlider: function() {
		if(this.slider) {
			this.slider.destroySlider();
			this.slider = null;
		}
	}
};

App.Control.install(PricesSliderBlocks);

App.Control.install({
	el: '.js-process-slider',
	name: 'processSlider',
	initialize: function () {

		this.slider = this.$el.bxSlider({
			pagerCustom: '#bx-pager',
			infiniteLoop: true,
			slideMargin:40,
			adaptiveHeight:true,
			nextSelector: '.js-process-slider__btn-holder',
			nextText: 'Следующий этап',
			onSliderLoad: function (slideElement) {
				$('.js-process-slider__btn').addClass('is-hide');
			},
			onSlideBefore: function (slideElement, oldIndex, newIndex) {
				// проверяем является ли слайд последним
				if (newIndex == lastSlideIndex) {
					$('.js-process-slider__btn-holder .bx-next').addClass('is-hide');
					$('.js-process-slider__btn').removeClass('is-hide');
				} else {
					$('.js-process-slider__btn').addClass('is-hide');
					$('.js-process-slider__btn-holder .bx-next').removeClass('is-hide');
				}

			}
		});

		var sliderLenght = this.slider.getSlideCount();
		var lastSlideIndex = sliderLenght - 1;
	}
});

App.Control.install({
	el: '.js-projects-slider',
	name: 'projectsSlider',
	initialize: function () {
		var sliderOpts = {
			slideWidth: 190,
			minSlides: 1,
			maxSlides: 6,
			slideMargin: 20,
			adaptiveHeight: true,
			moveSlides: 1
		};


		this.$el.bxSlider(sliderOpts);
	}
});

App.Control.install({
	el: '.js-publications-slider',
	name: 'publicationsSlider',
	slider: null,
	initialize: function () {
		var self = this;
		$(window).bind('load', function () {
			var isTouch = self.checkTouch();
			self.initSlider(isTouch);
		});
	},
	checkTouch: function () {
		var isTouchDevice = "ontouchstart" in window;
		return isTouchDevice;
	},
	initSlider: function (isTouch) {
		this.slider = this.$el.bxSlider({
			infiniteLoop: true,
			slideMargin: 30,
			adaptiveHeight: true,
			touchEnabled: isTouch,
		});
	}
});

App.Control.install({
	el: '.que',
	name: 'QueTip',
	initialize: function () {
		var self = this;
		this.$el.tooltipster({
			side: 'right',
			content: self.$el.html(),
			theme: ['tooltipster-light', 'tooltipster-light-customized'],
			maxWidth: 443
		});
	}
});

App.Control.extend('QueTip', {
	el: '.que-lp',
	name: 'QueTipLp'
});

App.Control.install({
    el     : '.js-reviews-slider',
    name   : 'reviewsSlider',
    slider : null,
    initialize: function () {

        var self = this;
        self.renderMode();

        $(window).bind('resize', function () {
            self.renderMode();
        });
    },
    renderMode: function () {
        var self = this;
        if ($(window).outerWidth() < 767) {
            self.initSmSlider();
        } else {
            self.destroySmSlider();
        }

    },

    initSmSlider: function () {
        if (!this.slider) {
            this.slider = this.$el.bxSlider({
                maxSlides   : 1,
                moveSlides  : 1,
                controls    : false,
                pager       : true
            });
        }
    },
    destroySmSlider: function () {
        if (this.slider) {
            this.slider.destroySlider();
            this.slider = null;
        }
    }
});
var ScrollTo = {
	el: '.js-scroll-to',
	name: 'ScrollTo',
	initialize: function () {
		this.targetObject = this.getTarget();
	},

	getTarget: function () {
		return $('#' + this.$el.attr('href').substring(1));
	},

	events: {
		'click': 'scrollTo'
	},

	scrollTo: function (ev) {
		ev.preventDefault();

		this.targetOffsetTop = this.targetObject.offset().top;
		this.listContentTarget = $(ev.currentTarget).hasClass('js-scroll-to--title-visible');


		//this.targetId = $(ev.currentTarget).attr('href');

		//this.titleHeight = $(this.targetId).outerHeight();


		if ($(window).outerWidth() < 900) {
			this.topOffset = 80;
		} else {
			this.topOffset = 20;
		}

		if (!$('.main-nav').hasClass('main-nav--fixed') && $(window).outerWidth() < 900) {
			this.targetOffsetTop -= $('.main-nav').outerHeight();
		} else {
			this.targetOffsetTop = this.targetObject.offset().top;

		}

		if (this.listContentTarget) {
			this.topOffset = 80;
			if (!$('.main-nav').hasClass('main-nav--fixed')) {
				this.targetOffsetTop -= $('.main-nav').outerHeight();
			} else {
				this.targetOffsetTop = this.targetObject.offset().top;
			}
		}


		$('html, body').animate({
			scrollTop: this.targetOffsetTop - this.topOffset
		}, 1000);
	}
};

App.Control.install(ScrollTo);

App.Control.install({
    el: '.js-scrollbar',
    name: 'ScrollBar',
    responsiveMarginPersent: 0,
    brackpointRulesItems: {},

    initialize: function () {

        this.contentClass = _.isUndefined(this.$el.data("scrollbarContentClass")) ? 'hscroll-wrapper' : this.$el.data("scrollbarContentClass");
        this.initScrollbar();

    },

    initScrollbar: function () {

        var self = this;

        this.$el.children().first().addClass(this.contentClass);

        this.scrollbar = this.$el.mCustomScrollbar({
            axis: "x",
            theme: "dark-2",
            autoExpandScrollbar: true,
            scrollInertia: 500,
            mouseWheel: {
                enable: false,
                normalizeDelta: true
            },
            keyboard: {
                enable: false
            },
            advanced: {
                autoExpandHorizontalScroll: true,
                updateOnContentResize: true
            },
            callbacks: {
                onBeforeUpdate: function () {
                    self.initItems();
                },
                onUpdate: function () {
                    self.resizeItems();
                }
            }
        });
    },

    initItems: function () {

        this.$('.' + this.contentClass).children().css('float', 'left');

    },

    resizeItems: function () {

        if (!_.isEmpty(this.brackpointRulesItems)) {

            var itemsInRow = 1;

            _.mapObject(this.brackpointRulesItems, function (val, key) {
                if ($(window).width() > key)
                    itemsInRow = val;
            });

            var marginWidth = (this.$el.width() * (this.responsiveMarginPersent / 100));
            this.$('.' + this.contentClass).children()
                .width(((this.$el.width() - (marginWidth * (itemsInRow - 1))) / itemsInRow) + 'px')
                .slice(1)
                .css('margin-left', marginWidth + 'px');

        }
    },

    destroyScrollbar: function () {
        this.$el.mCustomScrollbar('destroy');
    }
});


var ScrollBarEmployees = {
    el: '.js-scroll-employees',
    name: 'ScrollBarEmployees',
    responsiveMarginPersent: 3,
    brackpointRulesItems: {
        360: 2,
        515: 3,
        768: 4
    }
};
App.Control.extend('ScrollBar', ScrollBarEmployees);


App.Control.extend('ScrollBar', {
    el: '.js-scroll-mass-media',
    name: 'ScrollBarMassMedia',
    responsiveMarginPersent: 3,
    brackpointRulesItems: {
        360: 2,
        515: 3,
        768: 4
    }
});


App.Control.extend('ScrollBar', {
    el: '.js-scroll-clients',
    name: 'ScrollBarClients',
    responsiveMarginPersent: 3,
    brackpointRulesItems: {
        360: 2,
        515: 3,
        768: 4
    }
});

var SectionNav = {
    el: '.js-section-nav',
    name: 'SectionNav',
    initialize: function() {
        this.item = this.$('.js-section-nav__item');
        this.list = this.$('.js-section-nav__list');
    },

    events: {
        'click .js-section-nav__item': 'switchActiveState'

    },

    switchActiveState: function(e) {
        this.item.removeClass('is-active');
        $(e.currentTarget).addClass('is-active');


        if($(window).outerWidth() <= 649) {
            this.list.toggleClass('is-open');
            this.item.toggleClass('is-hide');

            this.item.not('.is-active').each(function(index, element) {
                $(element).css({
                    'top': $(element).outerHeight() * (index + 1)
                });
            });
        } else if($(window).outerWidth() > 650) {
            var itemGap = 2;

            this.list.removeClass('is-open');
            this.item.addClass('is-hide');

            this.item.not('.is-active').each(function(index, element) {
                $(element).css({
                    'top': -itemGap
                });
            });
        }
    }
};

App.Control.install(SectionNav);
var ShowCallbackForm = {
	el: '.js-show-callback-form',
	name: 'ShowCallbackForm',

	initialize: function () {
		this.btn = this.$('.js-show-callback-form__btn');
		this.closeBtn = this.$('.js-show-callback-form__close-btn');
		this.callbackForm = this.$('.js-show-callback-form__form');

		var self = this;

		$(document).on('keyup', function (e) {
			if (e.keyCode == 27) {
				self.hideFormOnClick();
			}
		});
	},

	events: {
		'click .js-show-callback-form__btn': 'showFormOnClick',
		'click .js-show-callback-form__close-btn': 'hideFormOnClick'
	},

	'showFormOnClick': function (e) {
		console.log(2);
		e.preventDefault();
		$(e.currentTarget).addClass('is-hidden');
		this.callbackForm.removeClass('is-hidden');
	},

	'hideFormOnClick': function (e) {
		this.btn.removeClass('is-hidden');
		this.callbackForm.addClass('is-hidden');
	}
};

App.Control.install(ShowCallbackForm);

var ShowContent = {
	el: '.js-show-content',
	name: 'ShowContent',

	initialize: function () {
		this.btn = this.$('.js-show-content__btn');
		this.hiddenContent = this.$('.js-show-content__content');
		this.hiddenBlock = this.$('.js-show-content__block');
		var self = this;
	},

	events: {
		'click .js-show-content__btn': 'showContent'
	},

	scrollTo: function () {
		var self = this;

		$('html, body').animate({
			scrollTop: $('[data-target=' + self.dataTarget + ']').offset().top - 60
		}, 1500);
	},

	showContent: function (e) {
		e.preventDefault();

		var needScroll = false;
		if (!$(e.currentTarget).hasClass('open') && $(e.currentTarget).data('scroll-to')) {
			needScroll = true;
		}

		if (!$(e.currentTarget).data('numbered-list')) {
			$(e.currentTarget).toggleClass('open');
		} else if ($(e.currentTarget).data('numbered-list')) {
			if ($(window).outerWidth() < 479) {
				$(e.currentTarget).toggleClass('open');
			}
		}

		if (!$(e.currentTarget).data('attribute')) {
			$(e.currentTarget).next('.js-show-content__content').slideToggle();

			if ($(window).outerWidth() <= 767) {
				this.$el.find('.js-show-content__block').slideToggle();
			}
		}

		// Если скрытую информацию и кнопку-триггер невозможно разместить в общем контейнере
		// Или скрытая информация расположена не после кнопки-триггера
		if (this.$el.filter('[data-attribute]')) {
			this.dataTarget = $(e.currentTarget).attr('data-attribute');
			$('[data-target=' + this.dataTarget + ']').slideToggle();
		}

		

		//Если скрытая информация должна скрывать только на мобильных разрешениях
		//Если кнопка-триггер есть только на мобильных разрешениях

		if (needScroll) {
			this.scrollTo();
		}
	}
};

App.Control.install(ShowContent);

var ShowMore = {
	el: '.js-show-more',
	name: 'ShowMore',

	initialize: function () {
		this.pagination = this.$('.js-show-more__pagination');
		this.item = this.$('.js-show-more__item');
		if (this.$el.hasClass('js-show-more--on-blue-bg')) {
			this.replaceDefaultPagination('btn-shadow--blue');
		} else {
			this.replaceDefaultPagination('');
		}
	},

	events: {
		'click .js-show-more__btn': 'showMoreItem'
	},

	replaceDefaultPagination: function (classNameElement) {
		this.pagination.remove();

		var brandNewBtn = $(document.createElement('button'))
			.addClass('btn js-show-more__btn')
			.attr('type', 'button')
			.text('Показать еще');

		var brandNewBtnContainer = $(document.createElement('div'))
			.addClass('btn-shadow ' + classNameElement)
			.append(brandNewBtn)
			.appendTo(this.$el);
	},

	showMoreItem: function () {
		if (this.$el.hasClass('js-partially-hidden__content')) {
			this.$el.parent('.js-partially-hidden__block').css({
				'height': 'auto'
			});
		}

		this.item.slideDown()
			.removeClass('is-hidden');
	}
};

App.Control.install(ShowMore);

var SliderEmployeesReviews = {
    el: '.js-employees-reviews',
    name: 'SliderEmployeesReviews',
    breakpoint: 768,
    slider: null,
	scroll: null,
    elementsCount: 0,
    initialize: function() {

		this.elementsCount = this.$el.find('.employee-reviews__item').length;

		this.renderMode();

		var self = this;
		$(window).bind('resize', function() {
			self.renderMode();
		});
    },

    renderMode: function () {
		var self = this;
		if($(window).outerWidth() < self.breakpoint) {
			self.destroySlider();
			self.initScroll();
		} else {
			self.destroyScroll();
			self.initSlider();
		}
	},

    initSlider: function() {
    	if(!this.slider) {
			this.slider = this.$el.find('.employee-reviews').bxSlider({
				pager: false,
				slideWidth: 960,
				minSlides: 1,
				maxSlides: 1,
				adaptiveHeight: true
			});
		}
    },

	destroySlider: function() {
		if(this.slider) {
			this.slider.destroySlider();
			this.slider = null;
		}
	},

	initScroll: function() {
		if(!this.scroll) {
			var self = this;
			this.scroll = this.$el.find('.employee-reviews').mCustomScrollbar({
				axis:"x",
				theme:"dark-2",
				autoExpandScrollbar:true,
				scrollInertia: 500,
				mouseWheel: {
					enable: true,
					normalizeDelta: true
				},
				keyboard:{
					enable: false
				},
				advanced:{
					autoExpandHorizontalScroll:true,
					updateOnContentResize: true
				},
				callbacks:{
					onUpdate:function(){
						self.$el.find('.employee-reviews__item')
							.width( (self.$el.width()) + 'px');
					}
				}
			});
		}
	},

	destroyScroll: function() {
		if(this.scroll) {
			this.scroll.mCustomScrollbar('destroy');
			this.scroll = null;
		}
	}
};

App.Control.install(SliderEmployeesReviews);
var SliderLinksCards = {
	el: '.js-slider-links-card',
	name: 'SliderLinksCard',
	breakpoint: 991,
	slider: null,
	scroll: null,
	elementsCount: 0,

	initialize: function() {
		this.elementsCount = this.$el.find('').length;
		var self = this;

		this.renderMode();

		$(window).bind('resize', function() {
			self.renderMode();
		});
	},

	renderMode: function () {
		var self = this;

		if($(window).outerWidth() > self.breakpoint) {
			self.destroySlider();
		} else {
			self.initSlider();
		}
	},

	initSlider: function() {
		if(!this.slider) {
			this.slider = this.$el.bxSlider({
				pager: false,
				slideWidth: 300,
				slideMargin: 30,
				minSlides: 1,
				maxSlides: 1,
				infiniteLoop: true
			});
		}
	},

	destroySlider: function() {
		if(this.slider) {
			this.slider.destroySlider();
			this.slider = null;
		}
	}
};

App.Control.install(SliderLinksCards);

var SliderPlateContent = {
	el: '.js-plate-content-slider',
	name: 'SliderPlateContent',

	initialize: function () {
		this.slider = this.$el.bxSlider({
			infiniteLoop: true,
			slideMargin: 30,
			adaptiveHeight: true,
		});
	}
};

App.Control.install(SliderPlateContent);

var SliderPriceCards = {
	el: '.js-slider-price-cards',
	name: 'SliderPriceCards',
	breakpoint: 1099,
	slider: null,
	scroll: null,
	elementsCount: 0,

	initialize: function() {
		this.elementsCount = this.$el.find('').length;
		var self = this;

		this.renderMode();

		$(window).bind('resize', function() {
			self.renderMode();
		});
	},

	renderMode: function () {
		var self = this;

		if($(window).outerWidth() > self.breakpoint) {
			self.destroySlider();
		} else {
			self.initSlider();
		}
	},

	initSlider: function() {
		var self = this;
		if(this.$el.is('[data-adaptive-height]') && $(window).outerWidth() < 768) {
			this.adaptive = true;
		} else {
			this.adaptive = false;
		}
		if(!this.slider) {
			this.slider = this.$el.bxSlider({
				pager: false,
				slideWidth: 400,
				slideMargin: 20,
				minSlides: 1,
				maxSlides: 1,
				infiniteLoop: true,
				startSlide: 1,
				adaptiveHeight:self.adaptive
			});
		}
	},

	destroySlider: function() {
		if(this.slider) {
			this.slider.destroySlider();
			this.slider = null;
		}
	}
};

App.Control.install(SliderPriceCards);

var SliderPromoPublications = {
    el: '.js-slider-promo-publications',
    name: 'SliderPromoPublications',
    initialize: function() {
        this.$el.bxSlider({
            controls: false,
            minSlides: 1,
            maxSlides: 1,
            adaptiveHeight: true
        });
    }
};

App.Control.install(SliderPromoPublications);
var SpeakersCarousel = {
	el: '.js-speakers__carousel',
	name: 'SpeakersCarousel',
	elClass: 'speakers-section__carousel-element--active',
	pagerClass: 'speakers-section__carousel-pager-element--active',
	initialize: function () {
		this.btn = this.$('.js-speakers-carousel__button');
	},

	events: {
		'click .js-speakers-carousel__button': 'slidesHandler'
	},

	slidesHandler: function (e) {
		var target = $(e.currentTarget);
		var id = target.attr('data-speaker-id');
		console.log(id);

		//toggle active class for pagers
		this.btn.siblings().removeClass(this.pagerClass);
		$(e.currentTarget).addClass(this.pagerClass);

		//toggle active class for elements
		this.$('.js-speakers-section__carousel-element').removeClass(this.elClass);
		$('[data-speaker="' + id + '"]').addClass(this.elClass);
	}
};

App.Control.install(SpeakersCarousel);

var StickyMediaLogo = {
	el: '.js-sticky-media-logo',
	name: 'StickyMediaLogo',

	initialize: function() {
		this.elHeight = this.$el.outerHeight();
		this.logo = this.$('.js-sticky-media-logo__logo');
		this.logoHeight = this.logo.outerHeight();

		if($(window).outerWidth() <= 899) {
			this.elBottomPadding = 158;
		} else {
			this.elBottomPadding = 100;
		}

		this.pushPoint = this.$el.offset().top;
		this.stopPoint = this.pushPoint + this.elHeight - this.logoHeight - this.elBottomPadding;

		var self = this;

		$(window).bind('resize', function() {
			self.elHeight = self.$el.outerHeight();
			self.logoHeight = self.logo.outerHeight();
			self.pushPoint = self.$el.offset().top;

			if($(window).outerWidth() <= 899) {
				self.elBottomPadding = 158;
			} else {
				self.elBottomPadding = 100;
			}

			self.stopPoint = self.pushPoint + self.elHeight - self.logoHeight - self.elBottomPadding;
		});

		$(window).bind('scroll', function() {
			self.elHeight = self.$el.outerHeight();
			self.stopPoint = self.pushPoint + self.elHeight - self.logoHeight - self.elBottomPadding;
			self.stickyOnScroll();
		});
	},

	stickyOnScroll: function() {
		if($(window).scrollTop() >= this.pushPoint && $(window).scrollTop() < this.stopPoint && $(window).outerWidth() >= 768) {
			this.logo.addClass('media-logo--fixed');
		} else {
			this.logo.removeClass('media-logo--fixed');
		}
	}
};

App.Control.install(StickyMediaLogo);
var SwitchActiveState = {
    el: '.js-switch-active',
    name: 'SwitchActiveState',
    initialize: function() {
        this.btn =  this.$('.js-switch-active__btn');
    },

    events: {
        'click .js-switch-active__btn': 'switchActiveState'
    },

    switchActiveState: function(e) {
        this.btn.siblings().removeClass('is-active');
        $(e.currentTarget).addClass('is-active')
    }
};

App.Control.install(SwitchActiveState);
var TabsControl = {
    el: '.js-tabs',
    name: 'Tabs',
    initialize: function() {
        this.tab = this.$('.js-tabs__tab');
        this.tabsOpened = this.$('.js-tabs__tab.is-open');
        this.tabsList = this.$('.js-tabs__list');
        this.tabContent = this.$('.js-tabs__content');
    },

    events: {
        'click .js-tabs__tab': 'switchTabOnClick'
    },

    switchTabOnClick: function(e) {
        this.tab.removeClass('is-active');
        $(e.currentTarget).addClass('is-active');

        this.targetId = $(e.currentTarget).data('id');

        this.tabContent.removeClass('is-active');
        $('#' + this.targetId).addClass('is-active');


        if($(window).outerWidth() <= 1019) {
            this.tabsList.toggleClass('is-open');
            this.tab.toggleClass('is-hide');

            this.tab.not('.is-active').each(function(index, element) {
                $(element).css({
                    'top': $(element).outerHeight() * (index + 1)
                });
            });
        } else if($(window).outerWidth() > 1019) {
            var tabGap = 2;

            this.tabsList.removeClass('is-open');
            this.tab.addClass('is-hide');

            this.tab.not('.is-active').each(function(index, element) {
                $(element).css({
                    'top': -tabGap
                });
            });
        }
    }
};

App.Control.install(TabsControl);
var TextCat = {
	el: '.text-cat',
	name: 'TextCat',

	initialize: function() {
		this.popupContent = _.unescape(this.$el.html());
		this.triggerLink = this.$el.attr('title');
		this.$el.html(this.triggerLink);

		var self = this;

		this.$el.bind('click', function(e) {
			$(e.currentTarget).hide();
			$(e.currentTarget).parent().after('<div class="text-cat-content">' + self.popupContent + '</div>');
			$(e.currentTarget).parent().next().after('<p><span class="text-cat-hide-btn">Скрыть</span></p>');
		});

		$(document).on('click', '.text-cat-hide-btn', function(){
		    $('.text-cat').show();
		    $(this).parent().prev().remove();
		    $(this).parent().remove();
		});
	}
};

App.Control.install(TextCat);
App.Control.install({
    el: '.text-popup',
    name: 'TextPopup',
    initialize: function () {
		this.popupContent = _.unescape(this.$el.html());
        this.triggerLink = this.$el.attr('title');
        this.$el.html(this.triggerLink);

        var self = this;

		this.$el.bind('click', function(e) {
			//$(e.currentTarget).hide();
			//$(e.currentTarget).parent().after('<div class="text-cat-content">' + self.popupContent + '</div>');
			//$(e.currentTarget).parent().next().after('<p><span class="text-cat-hide-btn">Скрыть</span></p>');
            console.log(self.popupContent);
			$.fancybox({
				wrapCSS: 'fancy-content',
				margin: ($(window).width() > 937) ? 20 : 5,
				fitToView: false,
				padding: 0,
				helpers : {
					overlay : {
						css : {
							'background' : 'rgba(27, 71, 105, 0.7)'
						}
					}
				},
				content: self.popupContent
			});
		});
    }
});
App.Control.install({
    el: '.text-tooltip',
    name: 'TextTooltip',
    initialize: function () {
        this.content = this.$el.html();
        this.triggerLink = this.$el.attr('title');
        //this.$el.html(this.triggerLink);

        var self = this;

        this.$el.tooltipster({
            content: self.content,
            theme: ['tooltipster-light', 'tooltipster-light-customized'],
            maxWidth: 443,
            trigger: 'click'
        });
    }
});


/*App.Control.extend('TextTooltip', {
    el: '.text-tooltip-bottom',
    name: 'TooltipBottom',
    direction: 'bottom',
    trigger: 'click'
});*/

App.Control.install({
	el: '.js-tooltip',
	name: 'Tooltip',
	direction: 'top',
	trigger: 'custom',
	interactive: false,
	initialize: function () {
		this.$el.tooltipster({
			side: this.direction,
			interactive: this.interactive,
			theme: ['tooltipster-light', 'tooltipster-light-customized'],
			maxWidth: 443,
			trigger: this.trigger,
			triggerOpen: {
				mouseenter: true,
				tap: true
			},
			triggerClose: {
				mouseleave: true,
				tap: true
			}
		});
	}
});


App.Control.install({
	el: '.js-tooltip-city',
	name: 'TooltipCity',
	initialize: function () {
		this.direction;
		var self = this;
		if (this.$el.hasClass('js-tooltip-city--header')) {
			this.direction = 'bottom';
		} else if (this.$el.hasClass('js-tooltip-city--footer')) {
			this.direction = 'right';
		}
		this.$el.tooltipster({
			side: self.direction,
			theme: ['tooltipster-light', 'tooltipster-light-customized'],
			trigger: 'click',
			contentCloning: true,
			interactive: true,
			functionReady: function (instance, helper) {
				$('.tooltipster-base').addClass('tooltipster-city-list');
			},
			functionBefore: function (instance, helper) {
				$('.tooltipster-overlay').addClass('is-active');
			},
			functionAfter: function (instance, helper) {
				$('.tooltipster-overlay').removeClass('is-active');
			}
		});
	}
});


App.Control.install({
	el: '.js-tooltip-overlay',
	name: 'TooltipOverlay',
	initialize: function () {
		this.$el.tooltipster({
			theme: ['tooltipster-light', 'tooltipster-light-customized', 'tootipster-patent-page'],
			trigger: 'click',
			side:'bottom',
			contentCloning: true,
			interactive: true,
			maxWidth: 440,
			functionBefore: function (instance, helper) {
				$('.tooltipster-overlay').addClass('is-active');
			},
			functionAfter: function (instance, helper) {
				$('.tooltipster-overlay').removeClass('is-active');
			}
		});
	}
});

App.Control.extend('Tooltip', {
	el: '.js-tooltip-right',
	name: 'TooltipRight',
	direction: 'right'
});

App.Control.extend('Tooltip', {
	el: '.js-tooltip-bottom',
	name: 'TooltipBottom',
	direction: 'bottom',
	contentCloning: true,
	interactive: true
});


var VerticalTabs = {
	el: '.js-vertical-tabs',
	name: 'VerticalTabs',
	cprefix: 'vtabs_',
	initialize: function () {
		var self = this;
		this.tab = this.$('.js-vertical-tabs__tab');
		this.tabsList = this.$('.js-vertical-tabs__list');
		this.tabContent = this.$('.js-vertical-tabs__content');
		if (this.$el.data('keep')) {
			this.keepCookieId = this.cprefix + this.$el.data('keep');
			var tabCookie = Cookies.get(this.keepCookieId);
			if (tabCookie)
				this.tab[tabCookie].click();
		} else
			this.keepCookieId = false;
	},

	events: {
		'click .js-vertical-tabs__tab': 'switchTabOnClick'

	},
	switchTabOnClick: function (e) {
		this.tab.removeClass('is-active');
		$(e.currentTarget).addClass('is-active');

		if (this.keepCookieId)
			Cookies.set(this.keepCookieId,
				this.tab.index(e.currentTarget));

		this.targetId = $(e.currentTarget).data('id');
		//this.tabId = this.targetId;
		//this.target = $(e.currentTarget);


		this.tabContent.removeClass('is-active');
		$('#' + this.targetId).addClass('is-active');


		if ($(window).outerWidth() <= 767) {
			this.tabsList.toggleClass('is-open');
			this.tab.toggleClass('is-hide');

			this.tab.not('.is-active').each(function (index, element) {
				$(element).css({
					'top': $(element).outerHeight() * (index + 1)
				});
			});
		} else if ($(window).outerWidth() > 767) {
			var tabGap = 3;

			this.tabsList.removeClass('is-open');
			this.tab.addClass('is-hide');

			this.tab.not('.is-active').each(function (index, element) {
				$(element).css({
					'top': -tabGap
				});
			});
		}

	}
};

App.Control.install(VerticalTabs);

var ExpertSliderRd = {
	el: '.js-expert-slider-rd',
	name: 'ExpertSliderRd',
	breakpoint: 768,
	slider: null,
	scroll: null,
	elementsCount: 0,

	initialize: function () {
		var self = this;
		this.movedChild = this.$el.find('.js-experts-block__btn--moved');
		this.deletedOnMobileElement =this.$el.find('.js-experts-slider__slide--deleted-on-mobile').find('.expert-rd__previews-section');

		this.renderMode();

		$(window).bind('resize', function () {
			self.renderMode();
		});
	},

	renderMode: function () {
		var self = this;

		if ($(window).outerWidth()< self.breakpoint) {
			self.destroySlider();
		} else {
			self.initSlider();
		}
	},

	initSlider: function () {
		this.movedChild.detach();
		this.deletedOnMobileElement.append(this.movedChild);
		
		if (!this.slider) {
			this.slider = this.$el.bxSlider({
				controls: false,
				pagerCustom: '#bx-pager',
			});
		}
	},

	destroySlider: function () {
		if (this.slider) {
			this.slider.destroySlider();
			this.slider = null;
		}
		this.movedChild.detach();
		$('.js-experts-slider__slide--scroll-on-mobile').find('.expert-rd__previews-section').append(this.movedChild);
	}
};

App.Control.install(ExpertSliderRd);

var ExpertsSlider = {
	el: '.js-experts-slider',
	name: 'ExpertsSlider',
	currentExperts:null,
	initialize: function () {
		var self = this;
		var sliderOpts = {
			slideMargin: 42,
			adaptiveHeight :true,
			onSliderLoad: function (index) {
				$('.js-experts-slider__slide').eq(index + 1).addClass('active');
				
			},
			onSlideBefore: function ($slideElement, oldIndex, newIndex) {
				$('.js-experts-slider__slide').removeClass('active');
				$slideElement.addClass('active');
			}
		};
		this.$el.bxSlider(sliderOpts);
	}
};

App.Control.install(ExpertsSlider);

var InfoSlider = {
	el: '.js-info-slider',
	name: 'InfoSlider',
	initialize: function () {
		this.$el.bxSlider({
			mode: 'fade',
			pager: false,
			auto: false,
			adaptiveHeight: true,
		});
	}
};
App.Control.install(InfoSlider);


var InfoSliderLp = {
	el: '.js-info-slider-lp',
	name: 'InfoSliderLp',
	slider: null,
	initialize: function () {
		this.slider = this.$el.bxSlider({
			slideMargin: 20,
			adaptiveHeight: false,
			infiniteLoop: true
		});
	}


};

App.Control.install(InfoSliderLp);

var MainNavView = {
	el: '.js-main-nav',
	name: 'MainNavView',
	initialize: function () {
		this.mainNavBtn = this.$('.js-main-nav__btn');
		this.mainNavList = this.$('.js-main-nav__list');
		this.mainNavListWrapper = this.$('.js-main-nav__list-wrapper');
		this.mainNavOffsetTop = this.$el.offset().top;
		this.mainNavHeight = this.$el.outerHeight();

		var self = this;

		$(window).bind('resize', function () {
			self.mainNavOffsetTop = self.$el.offset().top;
		});

		$(window).bind('scroll', function () {
			self.fixedNav();
		});
	},

	events: {
		'click .js-main-nav__btn': 'toggleNav'
	},

	toggleNav: function (evt) {
		this.$el.toggleClass('main-nav--open');
		this.mainNavList.toggleClass('main-nav__list--open');
		this.mainNavListWrapper.toggleClass('main-nav__list-wrapper--open');
		this.mainNavBtn.toggleClass('main-nav__menu-btn--open');
	},

	fixedNav: function () {
		if ($(window).scrollTop() > this.mainNavOffsetTop) {
			this.$el.addClass('main-nav--fixed');
		} else {
			this.$el.removeClass('main-nav--fixed');
		}

	}
};

App.Control.install(MainNavView);

var PageHeaderView = {
    el: '.js-page-header',
    name: 'PageHeaderView',
    initialize: function() {
        this.pageHeaderTop = this.$('.js-page-header__top');
        this.pageHeaderTopOffset = this.pageHeaderTop.offset().top;
        this.pageHeaderContacts = this.$('.js-page-heade__contacts');
        this.pageHeaderBtn = this.$('.js-page-heade__btn');
        //this.mainNavBtn = this.$('.js-main-nav__btn');
        this.mainNav = this.$('.js-page-header__main-nav');
        //this.mainNavOffsetTop = this.$el.offset().top;
        //this.mainNavHeight = this.$el.outerHeight();

        var self = this;

        $(window).bind('resize', function () {
            self.pageHeaderTopOffset = self.pageHeaderTop.offset().top;
        });

        $(window).bind('scroll', function () {
            self.fixedNav();
        });
    },

    events: {
        'click .js-page-heade__btn': 'toggleNav'
    },

    toggleNav: function(evt) {
        this.pageHeaderBtn.toggleClass('page-header-rd__btn--close');
        this.mainNav.toggleClass('main-nav--open');
    },

    fixedNav: function() {
        if ( $(window).scrollTop() > this.pageHeaderTopOffset) {
            this.pageHeaderContacts.addClass('page-header-rd__contacts--fixed');
        } else {
            this.pageHeaderContacts.removeClass('page-header-rd__contacts--fixed');
        }
    }
};

App.Control.install(PageHeaderView);
var MainSlider = {
    el: '.js-main-slider',
    name: 'MainSlider',
    initialize: function() {
        this.$el.bxSlider({
            mode: 'fade',
            pager: false,
            auto: true,
        });
    }
};

App.Control.install(MainSlider);
var MainSliderRd = {
	el: '.js-main-slider-rd',
	name: 'MainSliderRd',
	breakpoint: 768,
	slider: null,
	scroll: null,
	elementsCount: 0,

	initialize: function () {
		var self = this;
		this.slide = this.$('.js-main-slider-rd__slide');
		this.removedElement = this.slide.not(":eq(0)");

		this.renderMode();

		$(window).bind('resize', function () {
			self.renderMode();
		});
	},

	renderMode: function () {
		var self = this;

		if ($(window).outerWidth() < self.breakpoint) {
			this.removedElement.detach();
			self.destroySlider();
		} else {
			this.$el.append(this.removedElement);
			self.initSlider();
		}
	},

	initSlider: function () {
		if (!this.slider) {
			this.slider = this.$el.bxSlider({
				mode: 'fade',
				pager: false,
				auto: true,
				controls:false,
				pause: 3000,
				speed:1000
			});
		}
	},

	destroySlider: function () {
		if (this.slider) {
			this.slider.destroySlider();
			this.slider = null;
		}
	}
};

App.Control.install(MainSliderRd);

var VisitedPages = {
	el: '.js-visited-pages',
	name: 'VisitedPages',

	initialize: function() {
		this.mainSlider = $('.main-slider');
		this.mainSliderOffsetTop = this.mainSlider.offset().top;
		this.mainSliderHeight = this.mainSlider.outerHeight();

		this.container = this.$el.parent('.container');
		this.containerWidth = this.container.outerWidth();
		this.elWidth = ($(window).width() - this.containerWidth) / 2;

		this.pushPoint = this.mainSliderOffsetTop + this.mainSliderHeight;

		var self = this;

		this.setStickyBlockWidth();

		$(window).bind('resize', function() {
			self.elWidth = ($(window).width() - self.containerWidth) / 2;
			self.setStickyBlockWidth();
		});

		$(window).bind('scroll', function() {
			self.stickyOnScroll();
		});
	},

	setStickyBlockWidth: function() {
		this.$el.css({'width': this.elWidth});
	},

	stickyOnScroll: function() {
		if($(window).scrollTop() >= this.pushPoint) {
			this.$el.addClass('visited-pages--fixed');
		} else {
			this.$el.removeClass('visited-pages--fixed');
		}
	}
};

App.Control.install(VisitedPages);
App.Control.install({
    el: '.input-checkbox',
    name: 'InputCheckbox',
    initialize: function () {
        if(this.$('input').is(':checked'))
            this.$el.addClass('_checked');
    },
    events: {
        'change input': 'toggle'
    },
    toggle: function() {
        if(this.$('input').is(':checked'))
            this.$el.addClass('_checked');
        else
            this.$el.removeClass('_checked');
    }
});
/* ============================================================
 * bootstrap-dropdown.js v2.0.3
 * http://twitter.github.com/bootstrap/javascript.html#dropdowns
 * ============================================================
 * Copyright 2012 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ============================================================ */


!function ($) {

    "use strict"; // jshint ;_;


    /* DROPDOWN CLASS DEFINITION
     * ========================= */

    var toggle = '[data-toggle="dropdown"]'
        , Dropdown = function (element) {
        var $el = $(element).on('click.dropdown.data-api', this.toggle)
        $('html').on('click.dropdown.data-api', function () {
            $el.parent().removeClass('open')
        })
    }

    Dropdown.prototype = {

        constructor: Dropdown

        , toggle: function (e) {
            var $this = $(this)
                , $parent
                , selector
                , isActive

            if ($this.is('.disabled, :disabled')) return

            selector = $this.attr('data-target')

            if (!selector) {
                selector = $this.attr('href')
                selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') //strip for ie7
            }

            $parent = $(selector)
            $parent.length || ($parent = $this.parent())

            isActive = $parent.hasClass('open')

            clearMenus()

            if (!isActive) $parent.toggleClass('open')

            return false
        }

    }

    function clearMenus() {
        $(toggle).parent().removeClass('open')
    }


    /* DROPDOWN PLUGIN DEFINITION
     * ========================== */

    $.fn.dropdown = function (option) {
        return this.each(function () {
            var $this = $(this)
                , data = $this.data('dropdown')
            if (!data) $this.data('dropdown', (data = new Dropdown(this)))
            if (typeof option == 'string') data[option].call($this)
        })
    }

    $.fn.dropdown.Constructor = Dropdown


    /* APPLY TO STANDARD DROPDOWN ELEMENTS
     * =================================== */

    $(function () {
        $('html').on('click.dropdown.data-api', clearMenus)
        $('body')
            .on('click.dropdown', '.dropdown form', function (e) { e.stopPropagation() })
            .on('click.dropdown.data-api', toggle, Dropdown.prototype.toggle)
    })

}(window.jQuery);
var FileIconInput = {
	el: '.js-form-card-block-file',
	name: 'FileIconInput',

	initialize: function () {
		this.fileInput = this.$('input[type="file"]');
		this.textInput = this.$('input[type="text"]');
		this.filesName = this.$('.form-rd__files-name');
		this.filesBlock = this.$('.form-rd__files');
	},
	events: {
		'change [type=file]': 'changeValue'
	},
	changeValue: function (evt) {
		var self = this;
		var fileName = this.fileInput.val().replace(/.*\\/, "");
		this.textInput.val(fileName);
	}
};

App.Control.install(FileIconInput);

App.Control.install({
	el: '.input-file',
	name: 'InputFile',
	initialize: function () {
		console.log(2);

		this.$inputFile = this.$('input[type=file]')
			.addClass('file-hidden');

		var self = this;

		this.$inputPath = $(document.createElement('input'))
			.addClass('file-path-input')
			.attr('type','text')
			.attr('required',function () {
				if(self.$inputFile.attr('required'))
					return true;
			})
			.attr('readonly',true)
			.prependTo(this.$el);

		this.$inputButton = $(document.createElement('div'))
			.addClass('btn btn-input-file')
			.html('Обзор...')
			.prependTo(this.$('label'));

		this.$el.addClass('input-file2');

	},
	events: {
		'change [type=file]': 'changeValue'
	},
	changeValue: function() {
		this.$inputPath.val(this.$inputFile.val().replace('C:\\fakepath\\','')).trigger('input');
	}
});

App.Control.install({
	el: '.input-multifile',
	name: 'InputMultiFile',
	initialize: function () {

		var self = this;


		this.iAr = 1;



		this.inputName = this.$el.data('name');
		this.hiddenLink = this.$el.find('.input-multifile-link');

		if (this.$el.data('icon') || this.$el.data('inner-file')) {
			if (this.$el.data('multiple-text')) {
				this.$inputButton = $(document.createElement('span'))
					.addClass('dotted dotted--has-clip-icon')
					.html('или выберите несколько изображений для загрузки')
					.prependTo(this.$el);
			} else {
				this.$inputButton = $(document.createElement('span'))
					.addClass('dotted dotted--has-clip-icon')
					.html('Прикрепить файл')
					.prependTo(this.$el);
			}
		} else {
			this.$inputButton = $(document.createElement('div'))
				.addClass('btn btn-input-multifile')
				.html('Выбрать файл')
				.prependTo(this.$el);
		}

		if (this.$el.data('icon')) {
			this.$fileList = $(document.createElement('div'))
				.addClass('input-multifile__file-list input-multifile__file-list--no-padding')
				.prependTo(this.$el);
		} else if (this.$el.data('inner-file')) {
			this.$fileList = $(document.createElement('span'))
				.addClass('input-multifile__file-list input-multifile__file-list--no-padding')
				.addClass('is-hide')
				.appendTo(this.$el);
			this.$el.find('input[type=file]').addClass('is-hide');
		} else {
			this.$fileList = $(document.createElement('div'))
				.addClass('input-multifile__file-list')
				.prependTo(this.$el);
		}

		this.$inputButton.on('click', function () {
			self.startChoose($(this));
		});

		this.$('input[type=file]')
			.addClass('file-hidden');

	},
	startChoose: function () {
		var self = this;
		$lastInput = this.$el.find('input[type=file]').last();
		$lastInput.trigger('click');
		$lastInput.one('change', function () {
			if (!_.isEmpty($lastInput.val())) {
				var $dataMultiple = $(this).is('[data-multiple]');
				self.addtitionsFile2List($(this), $dataMultiple);

			} else {
				$(this).off();
			}
		});
	},
	addtitionsFile2List: function ($input, $dataMultiple) {
		var self = this,
			addFilePath = $input.val().replace('C:\\fakepath\\', ''),

			$inputIndex = this.$el.find('input[type=file]').index($input);
		var maxFiles = 5;


		if (_.isUndefined(this.$fileList.find('.input-multifile__file-item').get($inputIndex))) {


			if (!$dataMultiple) {
				self.addFileList(addFilePath, $dataMultiple);
			} else {
				var fileList = $input[0].files;
				var file, filePath, fileSize;

				var currentFileLenght = self.getChildLength();
				var terminateSum = currentFileLenght + fileList.length;
				
				var checkFileSize = self.checkFileSize(fileList);

				if (terminateSum <= maxFiles && checkFileSize) {
					//this.inputHighlightedText.hide();
					for (var i = 0; i < fileList.length; i++) {
						file = fileList[i];
						filePath = file.name.replace('C:\\fakepath\\', '');
						self.addFileList(filePath, $dataMultiple);

					}
				} else if (terminateSum > maxFiles || !checkFileSize) {
					this.hiddenLink.trigger('click');
				}


			}

		} else
			return null;

	},
	getChildLength: function (files) {
		var parentListChild = this.$el.find('.input-multifile__file-list').children();
		return parentListChild.length;
	},
	checkFileSize: function (fileList) {
		var file, filePath, fileSizeMg;
		var arr = [];
		var maxFileSize=5;
		for (var i = 0; i < fileList.length; i++) {
			file = fileList[i];
			fileSizeMg = file.size/1024/1024;
			arr.push(fileSizeMg);
			for(var y =0;y<arr.length;y++) {
				if(arr[i]>=maxFileSize) {
					return false;
				}
			}

		}
		return true;
	},

	addFileList: function ($fileName, data) {
		var self = this;
		var $itemFileRemoveBtn = $(document.createElement('span'))
			.addClass('input-multifile__file-item-remove')
			.html('&times;')
			.one('click', function () {
				self.removeFile4List($(this));
			});

		var $itemFileName = $(document.createElement('span'))
			.addClass('input-multifile__file-item-name')
			.html($fileName);

		var $fileItem = $(document.createElement('div'))
			.addClass('input-multifile__file-item')
			.append($itemFileName)
			.append($itemFileRemoveBtn)
			.appendTo(this.$fileList);

		var $nextFileInput = $(document.createElement('input'))
			.attr('type', 'file')
			.attr('name', this.inputName + '[' + (this.iAr++) + ']')
			.addClass('file-hidden')
			.appendTo(this.$el);


		if (data) {
			$nextFileInput
				.attr('multiple', 'multiple')
				.attr('accept', 'image/jpeg,image/png,image/gif')
				.attr('data-multiple', 'true');

		}

	},
	removeFile4List: function ($removeBtn) {

		var self = this;
		var minFiles = 0;
		$fileItem = $removeBtn.parent();
		$inputIndex = this.$fileList.find('.input-multifile__file-item').index($fileItem);

		$input = this.$el.find('input[type=file]').get($inputIndex);

		$fileItem.remove();
		$input.remove();

		/*var currentFile = self.getChildLength();
		if (currentFile == minFiles) {
			this.inputHighlightedText.hide();
		}*/


	}
});

App.Control.install({
    el: '.input-radio',
    name: 'InputRadio',
    initialize: function () {

        if(this.$('input').is(':checked'))
            this.$el.addClass('_checked');

        this.inputName = this.$('input').attr('name');
        this.$arOptions = $('body')
            .find('input[name=\'' + this.inputName + '\']')
            .parent();

    },
    events: {
        'change input': 'toggle'
    },
    toggle: function() {

        _.each(this.$arOptions, function(input){
            $(input).removeClass('_checked');
        });

        this.$el.addClass('_checked');

    }
});
var SliderWidget = {
	el: '.js-slider-widget',
	name: 'SliderWidget',

	initialize: function() {
		this.slider = this.$el.find('.js-slider-widget__slider');
        this.sliderValue = this.$el.find('.js-slider-widget__value');
        this.sliderDefaultValue = 1;

        this.initFormSlider();
	},

	initFormSlider: function() {
        var self = this;

        this.slider.slider({
            range: 'min',
            min: 1,
            max: self.slider.data('max-value'),
            step: 1,
            value: self.sliderValue.val(),

            slide: function(event, ui) {
                self.sliderValue.val(ui.value);
				self.sliderValue.trigger('change');
            }
        });

        this.sliderValue.on('input', function(e) {
            self.slider.slider('value', $(e.currentTarget).val());
        })
    }
};

App.Control.install(SliderWidget);
App.Control.install({
    el: '.spoiler-link',
    name: 'SpoilerContent',
    initialize: function () {
        this.$content = $();
        this.hidden = true;

        if(this.$el.data('closest'))
            this.$content = this.findClosest(this.$el);

        this.$content.hide(0);
    },
    events: {
        'click': 'toggle'
    },
    toggle: function() {
        if(this.hidden) {
            this.$el.addClass('_rolldown');
            this.hidden = false;
            this.$content.slideDown(400, function ()
                {}
            );
        } else {
            this.$el.removeClass('_rolldown');
            this.hidden = true;
            this.$content.slideUp(400, function ()
                {}
            );
        }
    },
    findClosest: function($el) {
        if($el.parent().length > 0) {
            $findRes = $el.parent().find('.spoiler-content');
            if ($findRes.length > 0) {
                return $($findRes[0]);
            } else {
                return  this.findClosest($el.parent())
            }
        }
        else
            return $();
    }
});