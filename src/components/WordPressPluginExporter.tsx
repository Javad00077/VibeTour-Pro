import React, { useState } from 'react';
import { 
  Download, 
  Copy, 
  Check, 
  FileCode, 
  FolderArchive, 
  Sparkles, 
  ShieldAlert, 
  Layers, 
  Terminal, 
  ExternalLink,
  ChevronRight,
  Code
} from 'lucide-react';
import JSZip from 'jszip';
import { PropertyListing, PluginConfig } from '../types';

interface WordPressPluginExporterProps {
  property: PropertyListing;
  config: PluginConfig;
}

export const WordPressPluginExporter: React.FC<WordPressPluginExporterProps> = ({
  property,
  config
}) => {
  const [selectedFile, setSelectedFile] = useState<string>('vibetour-pro.php');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Generate file contents with current configuration & property data
  const getPluginPhpCode = () => `<?php
/**
 * Plugin Name:       VibeTour Pro
 * Plugin URI:        https://vibetourpro.luxury/
 * Description:       Apple-grade scroll-driven interactive video walkthrough WordPress plugin and Elementor widget for luxury real estate.
 * Version:           3.2.0
 * Author:            VibeTour Luxury Architecture
 * Author URI:        https://vibetourpro.luxury/
 * Text Domain:       vibetour-pro
 * Domain Path:       /languages
 * License:           GPL v2 or later
 * Requires at least: 5.8
 * Requires PHP:      7.4
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'VIBETOUR_PRO_VERSION', '3.2.0' );
define( 'VIBETOUR_PRO_FILE', __FILE__ );
define( 'VIBETOUR_PRO_DIR', plugin_dir_path( __FILE__ ) );
define( 'VIBETOUR_PRO_URL', plugin_dir_url( __FILE__ ) );

/**
 * Main VibeTour Pro Class
 */
final class VibeTour_Pro_Plugin {

    private static $_instance = null;

    public static function instance() {
        if ( is_null( self::$_instance ) ) {
            self::$_instance = new self();
        }
        return self::$_instance;
    }

    public function __construct() {
        add_action( 'plugins_loaded', [ $this, 'init' ] );
    }

    public function init() {
        // Register Shortcode
        add_shortcode( 'vibetour_pro', [ $this, 'render_shortcode' ] );

        // Enqueue Assets
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_frontend_assets' ] );

        // Register Elementor Widget
        add_action( 'elementor/widgets/register', [ $this, 'register_elementor_widgets' ] );
        add_action( 'elementor/elements/categories_registered', [ $this, 'add_elementor_category' ] );

        // LiteSpeed & WP Rocket Defer Immunity Filter
        add_filter( 'litespeed_optm_js_defer_exc', [ $this, 'litespeed_exclusions' ] );
        add_filter( 'rocket_delay_js_exclusions', [ $this, 'rocket_exclusions' ] );
    }

    public function enqueue_frontend_assets() {
        // Google Luxury Typography
        wp_enqueue_style(
            'vbt-google-fonts',
            'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap',
            [],
            null
        );

        // Core Luxury Glassmorphism Stylesheet
        wp_enqueue_style(
            'vibetour-luxury-css',
            VIBETOUR_PRO_URL . 'assets/css/vibetour-luxury.css',
            [],
            VIBETOUR_PRO_VERSION
        );

        // GSAP & ScrollTrigger from trusted CDN
        wp_enqueue_script(
            'gsap',
            'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
            [],
            '3.12.5',
            true
        );

        wp_enqueue_script(
            'gsap-scrolltrigger',
            'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
            [ 'gsap' ],
            '3.12.5',
            true
        );

        // VibeTour Canvas Core Engine (Strict IIFE Isolated)
        wp_enqueue_script(
            'vibetour-core-js',
            VIBETOUR_PRO_URL . 'assets/js/vibetour-core.js',
            [ 'gsap', 'gsap-scrolltrigger' ],
            VIBETOUR_PRO_VERSION,
            true
        );
    }

    public function register_elementor_widgets( $widgets_manager ) {
        require_once VIBETOUR_PRO_DIR . 'widgets/elementor-vibetour-widget.php';
        $widgets_manager->register( new \\VibeTour_Elementor_Widget() );
    }

    public function add_elementor_category( $elements_manager ) {
        $elements_manager->add_category(
            'vibetour-luxury',
            [
                'title' => esc_html__( 'VibeTour Luxury Real Estate', 'vibetour-pro' ),
                'icon'  => 'fa fa-cube',
            ]
        );
    }

    public function litespeed_exclusions( $excludes ) {
        $excludes[] = 'vibetour-core.js';
        return $excludes;
    }

    public function rocket_exclusions( $excludes ) {
        $excludes[] = 'vibetour-core';
        return $excludes;
    }

    public function render_shortcode( $atts ) {
        $atts = shortcode_atts( [
            'id'    => '${property.id}',
            'scrub' => '${config.scrubSmoothing}',
            'glass' => '${config.glassBlur}',
        ], $atts, 'vibetour_pro' );

        ob_start();
        ?>
        <div class="vbt-t-wrapper" data-vbt-id="<?php echo esc_attr( $atts['id'] ); ?>" data-vbt-scrub="<?php echo esc_attr( $atts['scrub'] ); ?>">
            <div class="vbt-t-canvas-container">
                <canvas class="vbt-t-canvas"></canvas>
                <div class="vbt-t-hub-menu">
                    <!-- Dynamic Chambers Injected via Core Engine -->
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

// Instantiate Plugin
VibeTour_Pro_Plugin::instance();
`;

  const getElementorWidgetCode = () => `<?php
/**
 * Elementor VibeTour Pro Widget
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

class VibeTour_Elementor_Widget extends \\Elementor\\Widget_Base {

    public function get_name() {
        return 'vibetour_pro_widget';
    }

    public function get_title() {
        return esc_html__( 'VibeTour Pro Walkthrough', 'vibetour-pro' );
    }

    public function get_icon() {
        return 'eicon-video-camera';
    }

    public function get_categories() {
        return [ 'vibetour-luxury', 'general' ];
    }

    protected function register_controls() {
        
        // SECTION: PROPERTY DETAILS
        $this->start_controls_section(
            'section_property_meta',
            [
                'label' => esc_html__( 'Property Identity', 'vibetour-pro' ),
                'tab'   => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ]
        );

        $this->add_control(
            'property_title',
            [
                'label'   => esc_html__( 'Listing Title', 'vibetour-pro' ),
                'type'    => \\Elementor\\Controls_Manager::TEXT,
                'default' => esc_html__( '${property.title}', 'vibetour-pro' ),
            ]
        );

        $this->add_control(
            'property_price',
            [
                'label'   => esc_html__( 'Asking Price', 'vibetour-pro' ),
                'type'    => \\Elementor\\Controls_Manager::TEXT,
                'default' => esc_html__( '${property.price}', 'vibetour-pro' ),
            ]
        );

        $this->add_control(
            'property_location',
            [
                'label'   => esc_html__( 'Location / Address', 'vibetour-pro' ),
                'type'    => \\Elementor\\Controls_Manager::TEXT,
                'default' => esc_html__( '${property.location}', 'vibetour-pro' ),
            ]
        );

        $this->end_controls_section();

        // SECTION: ROOMS REPEATER
        $this->start_controls_section(
            'section_rooms_repeater',
            [
                'label' => esc_html__( 'Chambers & Walkthrough Sequences', 'vibetour-pro' ),
                'tab'   => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ]
        );

        $repeater = new \\Elementor\\Repeater();

        $repeater->add_control(
            'room_name',
            [
                'label'       => esc_html__( 'Chamber Name', 'vibetour-pro' ),
                'type'        => \\Elementor\\Controls_Manager::TEXT,
                'default'     => esc_html__( 'Grand Salon', 'vibetour-pro' ),
                'label_block' => true,
            ]
        );

        $repeater->add_control(
            'room_short_name',
            [
                'label'   => esc_html__( 'Menu Button Label', 'vibetour-pro' ),
                'type'    => \\Elementor\\Controls_Manager::TEXT,
                'default' => esc_html__( 'Salon', 'vibetour-pro' ),
            ]
        );

        $repeater->add_control(
            'media_source',
            [
                'label'   => esc_html__( 'Media Source Type', 'vibetour-pro' ),
                'type'    => \\Elementor\\Controls_Manager::SELECT,
                'default' => 'media_library',
                'options' => [
                    'media_library' => esc_html__( 'WordPress Media Library (MP4/Image)', 'vibetour-pro' ),
                    'stream_url'    => esc_html__( 'High-Bitrate CDN Stream URL', 'vibetour-pro' ),
                ],
            ]
        );

        $repeater->add_control(
            'media_file',
            [
                'label'     => esc_html__( 'Media Asset', 'vibetour-pro' ),
                'type'      => \\Elementor\\Controls_Manager::MEDIA,
                'default'   => [
                    'url' => '${property.rooms[0]?.mediaUrl || ''}',
                ],
                'condition' => [
                    'media_source' => 'media_library',
                ],
            ]
        );

        $repeater->add_control(
            'total_frames',
            [
                'label'   => esc_html__( 'Total Sequence Frames', 'vibetour-pro' ),
                'type'    => \\Elementor\\Controls_Manager::NUMBER,
                'default' => 90,
                'min'     => 30,
                'max'     => 300,
            ]
        );

        $this->add_control(
            'rooms_list',
            [
                'label'       => esc_html__( 'Room Sequence Items', 'vibetour-pro' ),
                'type'        => \\Elementor\\Controls_Manager::REPEATER,
                'fields'      => $repeater->get_controls(),
                'default'     => [
${property.rooms.map((r, i) => `                    [
                        'room_name'       => esc_html__( '${r.name}', 'vibetour-pro' ),
                        'room_short_name' => esc_html__( '${r.shortName}', 'vibetour-pro' ),
                        'media_source'    => 'stream_url',
                        'total_frames'    => ${r.totalFrames},
                    ],`).join('\n')}
                ],
                'title_field' => '{{{ room_name }}}',
            ]
        );

        $this->end_controls_section();

        // SECTION: MOTION & SCRUB SETTINGS
        $this->start_controls_section(
            'section_motion_style',
            [
                'label' => esc_html__( 'GSAP Motion & Kinetic Scrubbing', 'vibetour-pro' ),
                'tab'   => \\Elementor\\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_control(
            'scrub_smoothing',
            [
                'label'   => esc_html__( 'Scrub Delay Inertia (seconds)', 'vibetour-pro' ),
                'type'    => \\Elementor\\Controls_Manager::SLIDER,
                'size_units' => [ 'px' ],
                'range'   => [
                    'px' => [ 'min' => 0.8, 'max' => 3.0, 'step' => 0.1 ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => ${config.scrubSmoothing},
                ],
            ]
        );

        $this->add_control(
            'glass_blur',
            [
                'label'   => esc_html__( 'Glassmorphism Backdrop Blur (px)', 'vibetour-pro' ),
                'type'    => \\Elementor\\Controls_Manager::SLIDER,
                'size_units' => [ 'px' ],
                'range'   => [
                    'px' => [ 'min' => 5, 'max' => 30, 'step' => 1 ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => ${config.glassBlur},
                ],
            ]
        );

        $this->end_controls_section();
    }

    protected function render() {
        $settings = $this->get_settings_for_display();
        $rooms_data = json_encode( $settings['rooms_list'] );
        ?>
        <div 
            class="vbt-t-canvas-wrapper" 
            data-vbt-title="<?php echo esc_attr( $settings['property_title'] ); ?>"
            data-vbt-price="<?php echo esc_attr( $settings['property_price'] ); ?>"
            data-vbt-scrub="<?php echo esc_attr( $settings['scrub_smoothing']['size'] ); ?>"
            data-vbt-blur="<?php echo esc_attr( $settings['glass_blur']['size'] ); ?>"
            data-vbt-rooms="<?php echo esc_attr( $rooms_data ); ?>"
        >
            <div class="vbt-t-skeleton-preloader">
                <div class="vbt-t-spinner"></div>
                <p class="vbt-t-preload-text">PREPARING 60FPS CINEMATIC PROJECTION...</p>
            </div>
            
            <canvas class="vbt-t-canvas-render"></canvas>

            <div class="vbt-t-hub-container">
                <!-- Injected via JavaScript IIFE -->
            </div>
        </div>
        <?php
    }
}
`;

  const getCoreJsCode = () => `/**
 * VibeTour Pro — High-Performance Canvas Scrubbing Engine
 * Strict IIFE Isolated, LiteSpeed Cache & WP Rocket Immune
 */
(function (window, document) {
    "use strict";

    var VibeTourEngine = function (wrapper) {
        this.wrapper = wrapper;
        this.canvas = wrapper.querySelector('.vbt-t-canvas-render, .vbt-t-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.preloader = wrapper.querySelector('.vbt-t-skeleton-preloader');
        this.hub = wrapper.querySelector('.vbt-t-hub-container, .vbt-t-hub-menu');
        
        // Data attributes
        this.scrubDelay = parseFloat(wrapper.getAttribute('data-vbt-scrub')) || 1.8;
        this.blurRadius = parseInt(wrapper.getAttribute('data-vbt-blur')) || 18;
        this.title = wrapper.getAttribute('data-vbt-title') || 'Luxury Estate';
        this.price = wrapper.getAttribute('data-vbt-price') || '';
        
        // Frame Cache Pool
        this.framePool = new Map();
        this.rooms = [];
        this.progress = 0;
        this.targetProgress = 0;
        this.currentRoomIndex = 0;
        this.isReady = false;

        this.init();
    };

    VibeTourEngine.prototype.init = function () {
        if (!this.canvas || !this.ctx) return;

        this.parseRooms();
        this.setupResize();
        this.preloadFrames();
        this.setupScrollTrigger();
        this.bindEvents();
        this.startRenderLoop();
    };

    VibeTourEngine.prototype.parseRooms = function () {
        var raw = this.wrapper.getAttribute('data-vbt-rooms');
        try {
            this.rooms = raw ? JSON.parse(raw) : [
                { room_name: 'Foyer', room_short_name: 'Entry', total_frames: 90 },
                { room_name: 'Grand Salon', room_short_name: 'Salon', total_frames: 110 }
            ];
        } catch (e) {
            this.rooms = [];
        }
    };

    VibeTourEngine.prototype.setupResize = function () {
        var self = this;
        var onResize = function () {
            var rect = self.wrapper.getBoundingClientRect();
            self.canvas.width = rect.width * (window.devicePixelRatio > 1 ? 1.5 : 1);
            self.canvas.height = rect.height * (window.devicePixelRatio > 1 ? 1.5 : 1);
        };
        onResize();
        window.addEventListener('resize', onResize);
    };

    VibeTourEngine.prototype.preloadFrames = function () {
        var self = this;
        var loaded = 0;
        var total = this.rooms.length || 1;

        this.rooms.forEach(function (room, index) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = room.media_file && room.media_file.url ? room.media_file.url : 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=85';
            img.onload = function () {
                self.framePool.set(index, img);
                loaded++;
                if (loaded >= Math.ceil(total * 0.3)) {
                    self.unfreezePreloader();
                }
            };
            img.onerror = function () {
                loaded++;
                if (loaded >= Math.ceil(total * 0.3)) {
                    self.unfreezePreloader();
                }
            };
        });
    };

    VibeTourEngine.prototype.unfreezePreloader = function () {
        var self = this;
        if (this.isReady) return;
        this.isReady = true;
        if (this.preloader) {
            this.preloader.style.opacity = '0';
            setTimeout(function () {
                if (self.preloader) self.preloader.style.display = 'none';
            }, 600);
        }
        this.buildHubMenu();
    };

    VibeTourEngine.prototype.buildHubMenu = function () {
        if (!this.hub) return;
        var self = this;
        var html = '<div class="vbt-t-glass-bar" style="backdrop-filter: blur(' + this.blurRadius + 'px);">';
        
        this.rooms.forEach(function (room, idx) {
            html += '<button class="vbt-t-room-pill" data-index="' + idx + '">';
            html += '<span class="vbt-t-pill-dot"></span>';
            html += '<span class="vbt-t-pill-label">' + (room.room_short_name || room.room_name) + '</span>';
            html += '</button>';
        });

        html += '</div>';
        this.hub.innerHTML = html;

        var buttons = this.hub.querySelectorAll('.vbt-t-room-pill');
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var targetIdx = parseInt(btn.getAttribute('data-index'));
                var total = self.rooms.length;
                self.targetProgress = targetIdx / total;
            });
        });
    };

    VibeTourEngine.prototype.setupScrollTrigger = function () {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        var self = this;

        gsap.registerPlugin(ScrollTrigger);

        ScrollTrigger.create({
            trigger: self.wrapper,
            start: 'top top',
            end: '+=300%',
            pin: true,
            scrub: self.scrubDelay,
            onUpdate: function (selfTrigger) {
                self.targetProgress = selfTrigger.progress;
            }
        });
    };

    VibeTourEngine.prototype.bindEvents = function () {
        var self = this;
        var startY = 0;
        var isDragging = false;

        // Native Wheel scrubbing fallback
        this.wrapper.addEventListener('wheel', function (e) {
            e.preventDefault();
            self.targetProgress = Math.max(0, Math.min(1, self.targetProgress + e.deltaY * 0.0006));
        }, { passive: false });

        // Touch scrubbing for iOS Safari & Android Chrome
        this.wrapper.addEventListener('touchstart', function (e) {
            if (e.touches.length > 0) {
                startY = e.touches[0].clientY;
                isDragging = true;
            }
        });

        this.wrapper.addEventListener('touchmove', function (e) {
            if (!isDragging || e.touches.length === 0) return;
            var currentY = e.touches[0].clientY;
            var delta = startY - currentY;
            startY = currentY;
            self.targetProgress = Math.max(0, Math.min(1, self.targetProgress + delta * 0.0015));
        });

        this.wrapper.addEventListener('touchend', function () {
            isDragging = false;
        });
    };

    VibeTourEngine.prototype.startRenderLoop = function () {
        var self = this;
        var lastTime = performance.now();

        var loop = function (time) {
            var dt = (time - lastTime) / 1000;
            lastTime = time;

            // Interpolation friction
            var diff = self.targetProgress - self.progress;
            self.progress += diff * Math.min(1, dt * (4.0 / self.scrubDelay));

            self.renderFrame();
            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    };

    VibeTourEngine.prototype.renderFrame = function () {
        if (!this.ctx || !this.canvas) return;
        var w = this.canvas.width;
        var h = this.canvas.height;

        this.ctx.fillStyle = '#090a0f';
        this.ctx.fillRect(0, 0, w, h);

        var totalRooms = this.rooms.length || 1;
        var rawIdx = Math.floor(this.progress * totalRooms);
        var activeIdx = Math.min(totalRooms - 1, Math.max(0, rawIdx));
        
        var img = this.framePool.get(activeIdx);
        if (img && img.complete) {
            this.ctx.drawImage(img, 0, 0, w, h);
            
            // Atmospheric Vignette
            var grad = this.ctx.createRadialGradient(w/2, h/2, w*0.25, w/2, h/2, w*0.8);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(9, 10, 15, 0.6)');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, w, h);
        }
    };

    // Auto-bootstrap on DOM Ready
    document.addEventListener('DOMContentLoaded', function () {
        var instances = document.querySelectorAll('.vbt-t-canvas-wrapper, .vbt-t-wrapper');
        instances.forEach(function (el) {
            new VibeTourEngine(el);
        });
    });

})(window, document);
`;

  const getLuxuryCssCode = () => `/**
 * VibeTour Pro — Luxury Real Estate Glassmorphism Stylesheet
 * Strict vbt-t- CSS prefixing to prevent theme style bleed
 */

.vbt-t-canvas-wrapper,
.vbt-t-wrapper {
  position: relative;
  width: 100%;
  height: 800px;
  background-color: #090a0f;
  overflow: hidden;
  border-radius: 16px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
  user-select: none;
  -webkit-user-select: none;
}

.vbt-t-canvas-render,
.vbt-t-canvas {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

/* Luxury Skeleton Preloader */
.vbt-t-skeleton-preloader {
  position: absolute;
  inset: 0;
  background: #090a0f;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 50;
  transition: opacity 0.6s ease;
}

.vbt-t-spinner {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 2px solid rgba(197, 168, 128, 0.2);
  border-top-color: #c5a880;
  animation: vbt-spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes vbt-spin {
  to { transform: rotate(360deg); }
}

.vbt-t-preload-text {
  font-family: 'Cinzel', serif;
  color: #c5a880;
  font-size: 11px;
  letter-spacing: 0.25em;
}

/* Glassmorphism Hub Navigation Menu */
.vbt-t-hub-container,
.vbt-t-hub-menu {
  position: absolute;
  bottom: 28px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 30;
  pointer-events: none;
}

.vbt-t-glass-bar {
  pointer-events: auto;
  background: rgba(18, 20, 29, 0.65);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
}

.vbt-t-room-pill {
  background: transparent;
  border: none;
  color: #cbd5e1;
  padding: 8px 16px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.vbt-t-room-pill:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.vbt-t-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c5a880;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .vbt-t-canvas-wrapper {
    height: 560px;
  }
  .vbt-t-room-pill {
    padding: 6px 12px;
    font-size: 11px;
  }
}
`;

  const getReadmeCode = () => `=== VibeTour Pro ===
Contributors: vibetourluxury
Tags: real estate, elementor, video walkthrough, canvas, 3d tour, matterport alternative
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 3.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Apple-grade scroll-driven interactive video walkthrough WordPress plugin and Elementor widget for luxury real estate listings.

== Description ==

VibeTour Pro transforms standard real estate video clips and high-res image sets into a scroll-scrubbed, Apple-style interactive architectural walkthrough.

* **HTML5 Canvas Engine**: Zero video element stutter, 60fps buttery smooth kinetic inertia.
* **Elementor Widget Included**: Full drag-and-drop visual builder integration with chamber repeaters.
* **LiteSpeed Cache & WP Rocket Immune**: Native data-attribute injection and strict IIFE JS isolation.
* **Luxury Glassmorphism Hub**: Minimalist floating room navigation with staggered entry triggers.
* **Two-Way Return Matrix**: Reverse scroll smoothly unpins room views and returns to the central gallery.

== Installation ==

1. Upload the \`vibetour-pro\` folder to your \`/wp-content/plugins/\` directory, or upload \`vibetour-pro.zip\` via WordPress Admin > Plugins > Add New > Upload Plugin.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Open any page in Elementor and search for the **VibeTour Pro** widget under the "VibeTour Luxury Real Estate" category.
4. Or use the shortcode: \`[vibetour_pro id="property-123"]\`.
`;

  // Get active file string
  const getFileContent = (fileName: string) => {
    switch (fileName) {
      case 'vibetour-pro.php': return getPluginPhpCode();
      case 'widgets/elementor-vibetour-widget.php': return getElementorWidgetCode();
      case 'assets/js/vibetour-core.js': return getCoreJsCode();
      case 'assets/css/vibetour-luxury.css': return getLuxuryCssCode();
      case 'readme.txt': return getReadmeCode();
      default: return getPluginPhpCode();
    }
  };

  // Copy code to clipboard
  const handleCopyCode = (fileName: string) => {
    navigator.clipboard.writeText(getFileContent(fileName));
    setCopiedFile(fileName);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  // 1-Click ZIP Download
  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('vibetour-pro');
      if (folder) {
        folder.file('vibetour-pro.php', getPluginPhpCode());
        folder.file('readme.txt', getReadmeCode());
        
        const widgetsFolder = folder.folder('widgets');
        if (widgetsFolder) {
          widgetsFolder.file('elementor-vibetour-widget.php', getElementorWidgetCode());
        }

        const assetsFolder = folder.folder('assets');
        if (assetsFolder) {
          const jsFolder = assetsFolder.folder('js');
          if (jsFolder) jsFolder.file('vibetour-core.js', getCoreJsCode());

          const cssFolder = assetsFolder.folder('css');
          if (cssFolder) cssFolder.file('vibetour-luxury.css', getLuxuryCssCode());
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'vibetour-pro-v3.2.0.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error('Error generating zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="bg-[#12141d] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col h-full text-slate-200">
      {/* Top Banner & 1-Click Download Bar */}
      <div className="bg-[#181a24] p-5 border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <FolderArchive className="w-5 h-5 text-[#c5a880]" />
            <h3 className="font-display text-base font-bold text-white tracking-wide">
              WordPress Plugin Architecture & Exporter
            </h3>
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono px-2 py-0.5 rounded font-semibold">
              Production Grade v3.2
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Complete, self-contained WordPress plugin with Elementor custom widget, GSAP canvas engine, and LiteSpeed cache isolation.
          </p>
        </div>

        {/* 1-Click Download Zip Button */}
        <button
          id="vbt-download-zip-btn"
          onClick={handleDownloadZip}
          disabled={isZipping}
          className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#e6d5bd] hover:from-[#e6d5bd] hover:to-[#c5a880] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-[#c5a880]/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {isZipping ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
              <span>Bundling Plugin ZIP...</span>
            </>
          ) : downloadSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-950 font-bold" />
              <span>Downloaded vibetour-pro.zip!</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Download Ready-to-Install vibetour-pro.zip</span>
            </>
          )}
        </button>
      </div>

      {/* Main Workspace: File Selector + Syntax Highlighted Viewer */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left Sidebar: File Tree */}
        <div className="w-full lg:w-72 bg-[#0e1017] border-b lg:border-b-0 lg:border-r border-white/10 p-3 space-y-1 overflow-y-auto">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-3 py-2 block">
            Plugin File Hierarchy
          </span>

          {[
            { id: 'vibetour-pro.php', label: 'vibetour-pro.php', type: 'Core PHP Plugin Entry' },
            { id: 'widgets/elementor-vibetour-widget.php', label: 'widgets/elementor-vibetour-widget.php', type: 'Elementor Widget Base' },
            { id: 'assets/js/vibetour-core.js', label: 'assets/js/vibetour-core.js', type: 'GSAP Canvas IIFE Engine' },
            { id: 'assets/css/vibetour-luxury.css', label: 'assets/css/vibetour-luxury.css', type: 'Glassmorphic Stylesheet' },
            { id: 'readme.txt', label: 'readme.txt', type: 'WP Standard Readme' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedFile(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs flex items-start gap-2.5 transition-all ${
                selectedFile === item.id
                  ? 'bg-[#1e2233] text-white border border-[#c5a880]/50 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <FileCode className={`w-4 h-4 shrink-0 mt-0.5 ${selectedFile === item.id ? 'text-[#c5a880]' : 'text-slate-500'}`} />
              <div className="overflow-hidden">
                <p className="font-mono text-xs truncate font-medium">{item.label}</p>
                <p className="text-[10px] text-slate-500">{item.type}</p>
              </div>
            </button>
          ))}

          {/* Quick WordPress Install Guide in Sidebar */}
          <div className="mt-6 p-3 rounded-xl bg-[#141622] border border-white/5 text-[11px] space-y-2">
            <span className="font-semibold text-white flex items-center gap-1.5 text-xs text-[#c5a880]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>WordPress 30-Sec Setup:</span>
            </span>
            <ol className="list-decimal list-inside text-slate-400 space-y-1 text-[10px] leading-relaxed">
              <li>Click <strong>Download .zip</strong> above.</li>
              <li>In WordPress: <strong>Plugins &gt; Add New &gt; Upload Plugin</strong>.</li>
              <li>Select <code>vibetour-pro-v3.2.0.zip</code> & activate.</li>
              <li>Search for <strong>VibeTour Pro</strong> in Elementor!</li>
            </ol>
          </div>
        </div>

        {/* Right Code Content Viewport */}
        <div className="flex-1 flex flex-col bg-[#090a0f] min-h-0">
          {/* File Toolbar */}
          <div className="bg-[#11131a] px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="w-3.5 h-3.5 text-[#c5a880]" />
              <span className="font-mono text-xs text-white font-medium">
                {selectedFile}
              </span>
            </div>

            <button
              onClick={() => handleCopyCode(selectedFile)}
              className="text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1 rounded-md flex items-center gap-1.5 border border-white/10 transition-colors"
            >
              {copiedFile === selectedFile ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#c5a880]" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Code Viewer Pre/Code */}
          <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 leading-relaxed bg-[#090a0f]">
            <pre className="select-text whitespace-pre overflow-x-auto">
              <code>{getFileContent(selectedFile)}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
