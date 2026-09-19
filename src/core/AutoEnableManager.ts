/**
 * AutoEnableManager - Manages automatic detection and enabling of novel reader
 *
 * Flow:
 * 1. Check if built-in rule matches → auto-launch
 * 2. Run auto-detection → show prompt if confidence >= threshold
 * 3. User confirms → optionally remember site preference → launch reader
 */

import {
  DetectionEngine,
  type DetectionEngineResult,
  getChapterDocumentBlockReason,
} from '@/core/detection';
import { getPageKind, getPageKindFromUrl } from '@/core/auto-enable/PageKind';
import { getSiteProtection, type ProtectionOptions } from '@/core/protection';
import { type ParsedChapter, Parser } from '@/core/parser';
import { createSectionMerger } from '@/core/auto-enable/SectionMerger';
import { getRuleManager } from '@/core/rules/RuleManager';
import { getRuleStorage } from '@/core/rules/RuleStorage';
import type { SiteRule } from '@/core/rules/types';

/** Auto-enable decision result */
export interface AutoEnableDecision {
  /** Whether to show the reader */
  shouldEnable: boolean;
  /** How the decision was made */
  method: 'builtin-rule' | 'detection' | 'manual' | 'user-disabled' | 'site-preference';
  /** Confidence level (0-1) */
  confidence: number;
  /** The rule to use (if any) */
  rule?: SiteRule;
  /** Detection result (if detection was used) */
  detection?: DetectionEngineResult;
  /** Reasons for the decision */
  reasons: string[];
  /** Whether to keep a manual reader entry visible */
  showManualEntry?: boolean;
}

/** User prompt response */
export interface UserPromptResponse {
  /** User accepted */
  accepted: boolean;
  /** Remember this site should auto-enable in future */
  rememberForSite: boolean;
}

/** Callback for showing prompt to user */
export type PromptCallback = () => Promise<UserPromptResponse>;

/** Callback when reader should launch */
export type LaunchCallback = (
  chapter: ParsedChapter,
  rule?: SiteRule,
  stage?: 'initial' | 'update' | 'complete'
) => void;

/** Auto-enable options */
export interface AutoEnableOptions {
  /** Minimum confidence for auto-prompt (default: 0.6) */
  confidenceThreshold?: number;
  /** Minimum confidence for auto-launch without prompt (default: 0.9) */
  autoLaunchThreshold?: number;
  /** Enable site protection measures */
  enableProtection?: boolean;
  /** Options for site protection */
  protectionOptions?: ProtectionOptions;
  /** Skip detection if URL matches these patterns */
  skipPatterns?: RegExp[];
  /** Force detection mode (ignore rules) */
  forceDetection?: boolean;
}

const DEFAULT_OPTIONS: AutoEnableOptions = {
  confidenceThreshold: 0.6,
  autoLaunchThreshold: 0.9,
  enableProtection: true,
  skipPatterns: [
    /\/(login|register|auth|account)/i,
    /\/(search|find)/i,
    /\/(cart|checkout|pay)/i,
    /\/(user|profile|setting)/i,
    /\/(forum|comment|review)/i,
    /\/(download|upload)/i,
  ],
};

export class AutoEnableManager {
  private options: AutoEnableOptions;
  private detectionEngine: DetectionEngine;
  private parser: Parser;
  private sectionMerger: ReturnType<typeof createSectionMerger>;
  private promptCallback?: PromptCallback;
  private launchCallback?: LaunchCallback;
  private hasRun = false;
  private currentDecision?: AutoEnableDecision;
  private currentDecisionUrl?: string;

  private recordDecision(url: string, decision: AutoEnableDecision): AutoEnableDecision {
    this.currentDecision = decision;
    this.currentDecisionUrl = url;
    return decision;
  }

  private activateProtection(): void {
    if (!this.options.enableProtection) return;

    const protection = getSiteProtection();
    protection.activate(this.options.protectionOptions);
    // Overlay removal mutates the host page irreversibly, and the reader already hides the host
    // page while open, so keep it to aggressive mode (the only mode that opts into cleanup).
    if (this.options.protectionOptions?.cleanupScripts) {
      protection.removeOverlays();
    }
  }

  private deactivateProtection(): void {
    if (this.options.enableProtection) {
      getSiteProtection().deactivate();
    }
  }

  constructor(options: AutoEnableOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.detectionEngine = new DetectionEngine();
    this.parser = new Parser({
      forceDetection: options.forceDetection,
    });
    this.sectionMerger = createSectionMerger(this.parser);
  }

  updateOptions(options: AutoEnableOptions = {}): void {
    this.options = { ...this.options, ...options };
    if (Object.prototype.hasOwnProperty.call(options, 'forceDetection')) {
      this.parser = new Parser({
        forceDetection: options.forceDetection,
      });
      this.sectionMerger = createSectionMerger(this.parser);
    }
  }

  /**
   * Set the callback for prompting user
   */
  setPromptCallback(callback: PromptCallback): void {
    this.promptCallback = callback;
  }

  /**
   * Set the callback for launching reader
   */
  setLaunchCallback(callback: LaunchCallback): void {
    this.launchCallback = callback;
  }

  /**
   * Run the auto-enable check
   */
  async check(doc: Document = document): Promise<AutoEnableDecision> {
    const url = doc.location?.href || window.location.href;
    const decide = (decision: AutoEnableDecision): AutoEnableDecision =>
      this.recordDecision(url, decision);

    const blockReason = getChapterDocumentBlockReason(doc);
    if (blockReason === 'cloudflare') {
      return decide({
        shouldEnable: false,
        method: 'manual',
        confidence: 0,
        reasons: ['Cloudflare Challenge 页面，等待验证完成'],
      });
    }
    if (blockReason === 'vip') {
      return decide({
        shouldEnable: false,
        method: 'manual',
        confidence: 0,
        reasons: ['VIP/付费章节，跳过阅读器解析'],
      });
    }

    // Check skip patterns
    if (this.shouldSkip(url)) {
      return decide({
        shouldEnable: false,
        method: 'manual',
        confidence: 0,
        reasons: ['URL matches skip pattern'],
      });
    }

    const urlPageKind = getPageKindFromUrl(url);
    if (urlPageKind === 'toc') {
      return decide({
        shouldEnable: false,
        method: 'manual',
        confidence: 0,
        reasons: ['目录页，跳过自动启用'],
      });
    }

    const hostname = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return null;
      }
    })();
    const sitePreference = hostname ? getRuleStorage().getSitePreference(hostname) : null;

    // Check site preference immediately when URL alone proves this is a chapter.
    if (urlPageKind === 'chapter') {
      if (sitePreference?.enabled === false) {
        // User previously disabled auto-entry on this site; retain an explicit manual entry.
        return decide({
          shouldEnable: false,
          method: 'user-disabled',
          confidence: 0,
          reasons: ['用户已关闭该站点自动启用'],
          showManualEntry: true,
        });
      }
      if (sitePreference?.enabled === true) {
        return decide({
          shouldEnable: true,
          method: 'site-preference',
          confidence: 1,
          reasons: ['用户已为该站点开启自动启用'],
        });
      }
    }

    // Check built-in rules first.
    // Explicit rules should still apply even if quickCheck is a false negative.
    if (!this.options.forceDetection) {
      const ruleManager = getRuleManager();
      await ruleManager.initialize();
      const ruleMatch = await ruleManager.matchRule(url);

      if (ruleMatch) {
        if (sitePreference?.enabled === false) {
          return decide({
            shouldEnable: false,
            method: 'user-disabled',
            confidence: 0,
            reasons: ['用户已关闭该站点自动启用'],
            showManualEntry: true,
          });
        }

        const decision: AutoEnableDecision = {
          shouldEnable: true,
          method: 'builtin-rule',
          confidence: 1.0,
          rule: ruleMatch.rule,
          reasons: [`Matched builtin rule: ${ruleMatch.rule.name || ruleMatch.rule.id}`],
        };
        return decide(decision);
      }
    }

    const pageKind = urlPageKind === 'other' ? getPageKind(url, doc) : urlPageKind;
    if (pageKind === 'toc') {
      return decide({
        shouldEnable: false,
        method: 'manual',
        confidence: 0,
        reasons: ['目录页，跳过自动启用'],
      });
    }

    if (sitePreference?.enabled === false) {
      return decide({
        shouldEnable: false,
        method: 'user-disabled',
        confidence: 0,
        reasons: ['用户已关闭该站点自动启用'],
        showManualEntry: true,
      });
    }
    if (sitePreference?.enabled === true) {
      return decide({
        shouldEnable: true,
        method: 'site-preference',
        confidence: 1,
        reasons: ['用户已为该站点开启自动启用'],
      });
    }

    if (pageKind !== 'chapter') {
      return decide({
        shouldEnable: false,
        method: 'manual',
        confidence: 0,
        reasons: ['非正文页，跳过自动启用'],
      });
    }

    // Quick check before running full detection
    if (!this.detectionEngine.quickCheck(doc)) {
      return decide({
        shouldEnable: false,
        method: 'manual',
        confidence: 0,
        reasons: ['Page does not appear to be novel content'],
      });
    }

    // Run detection
    const detection = this.detectionEngine.detect(doc, doc.location?.href || window.location.href);

    const decision: AutoEnableDecision = {
      shouldEnable: detection.confidence.overall >= (this.options.confidenceThreshold || 0.6),
      method: 'detection',
      confidence: detection.confidence.overall,
      detection,
      reasons: detection.confidence.reasons,
    };

    return decide(decision);
  }

  /**
   * Execute the auto-enable flow
   */
  async execute(doc: Document = document): Promise<void> {
    if (this.hasRun) {
      return;
    }
    this.hasRun = true;

    const currentUrl = doc.location?.href || window.location.href;
    const decision =
      this.currentDecision && this.currentDecisionUrl === currentUrl
        ? this.currentDecision
        : await this.check(doc);

    if (!decision.shouldEnable) {
      this.deactivateProtection();
      return;
    }

    // Auto-launch for high confidence or rule match
    const shouldAutoLaunch =
      decision.method === 'builtin-rule' ||
      decision.confidence >= (this.options.autoLaunchThreshold || 0.9);

    if (shouldAutoLaunch) {
      await this.launch(doc, decision);
      return;
    }

    // Show prompt for medium confidence detection
    if (this.promptCallback) {
      this.deactivateProtection();
      const response = await this.promptCallback();

      if (response.accepted) {
        const launched = await this.launch(doc, decision);
        if (launched && response.rememberForSite) {
          this.rememberSiteEnabled(doc);
        }
      }
      return;
    }

    this.deactivateProtection();
  }

  /**
   * Launch the reader
   */
  private async launch(doc: Document, decision: AutoEnableDecision): Promise<boolean> {
    this.activateProtection();

    let launchedEarly = false;
    try {
      const currentUrl = doc.location?.href || window.location.href;
      const chapter = await this.sectionMerger.merge(doc, currentUrl, {
        onFirstPage: firstPage => {
          if (!this.launchCallback) return;
          this.launchCallback(firstPage, decision.rule || firstPage.rule, 'initial');
          launchedEarly = true;
        },
      });

      if (chapter && this.launchCallback) {
        this.launchCallback(
          chapter,
          decision.rule || chapter.rule,
          launchedEarly ? 'update' : 'complete'
        );
        return true;
      }
      if (launchedEarly) return true;
      this.deactivateProtection();
      return false;
    } catch (e) {
      console.error('[AutoEnableManager] Parse error:', e);
      if (launchedEarly) return true;
      this.deactivateProtection();
      return false;
    }
  }

  private rememberSiteEnabled(doc: Document): void {
    const url = doc.location?.href || window.location.href;
    if (getPageKind(url, doc) !== 'chapter') return;

    try {
      const hostname = new URL(url).hostname;
      const storage = getRuleStorage();
      // Only an unset preference may become enabled; an explicit opt-out survives manual entry.
      if (storage.getSitePreference(hostname)) return;
      storage.setSitePreference(hostname, { enabled: true, timestamp: Date.now() });
    } catch (e) {
      console.error('[AutoEnableManager] Failed to save site preference:', e);
    }
  }

  /**
   * Check if URL should be skipped
   */
  private shouldSkip(url: string): boolean {
    return (this.options.skipPatterns || []).some(pattern => pattern.test(url));
  }

  /**
   * Get the current decision
   */
  getDecision(): AutoEnableDecision | undefined {
    return this.currentDecision;
  }

  /**
   * Reset manager state (for testing)
   */
  reset(): void {
    this.hasRun = false;
    this.currentDecision = undefined;
    this.currentDecisionUrl = undefined;
  }

  /**
   * Manual enable (force launch without detection)
   */
  async manualEnable(doc: Document = document): Promise<void> {
    const blockReason = getChapterDocumentBlockReason(doc);
    if (blockReason) {
      console.info(`[AutoEnableManager] Manual enable skipped: ${blockReason}`);
      this.deactivateProtection();
      return;
    }

    this.activateProtection();

    // Parse and launch
    let launched = false;
    try {
      const currentUrl = doc.location?.href || window.location.href;
      const chapter = await this.sectionMerger.merge(doc, currentUrl, {
        onFirstPage: firstPage => {
          if (!this.launchCallback) return;
          this.launchCallback(firstPage, firstPage.rule, 'initial');
          launched = true;
        },
      });

      if (chapter && this.launchCallback) {
        this.launchCallback(chapter, chapter.rule, launched ? 'update' : 'complete');
        this.rememberSiteEnabled(doc);
        launched = true;
      }
    } catch (e) {
      console.error('[AutoEnableManager] Manual enable error:', e);
    } finally {
      if (!launched) {
        this.deactivateProtection();
      }
    }
  }
}

// Singleton instance
let managerInstance: AutoEnableManager | null = null;

/**
 * Get the singleton AutoEnableManager instance
 */
export function getAutoEnableManager(options?: AutoEnableOptions): AutoEnableManager {
  if (!managerInstance) {
    managerInstance = new AutoEnableManager(options);
  } else if (options) {
    managerInstance.updateOptions(options);
  }
  return managerInstance;
}
