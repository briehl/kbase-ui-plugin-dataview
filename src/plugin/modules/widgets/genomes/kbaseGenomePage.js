/*global
 define
 */
/*jslint
 browser: true,
 white: true
 */
/**
 * Shows general gene info.
 * Such as its name, synonyms, annotation, publications, etc.
 *
 * Gene "instance" info (e.g. coordinates on a particular strain's genome)
 * is in a different widget.
 */
define([
    'jquery',
    'kb/common/html',
    'kb/service/client/workspace',
    'kb_sdk_clients/GenomeAnnotationAPI/dev/GenomeAnnotationAPIClient',
    'kb_sdk_clients/AssemblyAPI/dev/AssemblyAPIClient',
    'kb/widget/legacy/widget',
    'kb_dataview_genomes_wideOverview',
    'kb_dataview_genomes_literature',
    'kb_dataview_genomes_wideTaxonomy',
    'kb_dataview_genomes_wideAssemblyAnnotation',
],
    function ($, html, Workspace, GenomeAnnotationAPI, AssemblyAPI) {
        'use strict';
        $.KBWidget({
            name: "KBaseGenomePage",
            parent: "kbaseWidget",
            version: "1.0.0",
            options: {
                genomeID: null,
                workspaceID: null,
                ver: null
            },
            init: function (options) {
                this._super(options);
                if (this.options.workspaceID === 'CDS') {
                    this.options.workspaceID = 'KBasePublicGenomesV4';
                }
                this.render();
                return this;
            },
            render: function () {
                var self = this;
                var scope = {ws: this.options.workspaceID, id: this.options.genomeID, ver: this.options.ver};

                var ga_api = new GenomeAnnotationAPI({
                    url: this.runtime.getConfig('services.service_wizard.url'),
                    auth: {'token': this.runtime.service('session').getAuthToken()},
                    version: 'release'
                });
                
                var asm_api = new AssemblyAPI({
                    url: this.runtime.getConfig('services.service_wizard.url'),
                    auth: {'token': this.runtime.service('session').getAuthToken()},
                    version: 'release'
                });
                
                var cell1 = $('<div panel panel-default">');
                self.$elem.append(cell1);
                var panel1 = self.makePleaseWaitPanel();
                self.makeDecoration(cell1, 'Overview', panel1);

                var cell2 = $('<div panel panel-default">');
                self.$elem.append(cell2);
                var panel2 = self.makePleaseWaitPanel();
                self.makeDecoration(cell2, 'Publications', panel2);

                var cell3 = $('<div panel panel-default">');
                self.$elem.append(cell3);
                var panel3 = self.makePleaseWaitPanel();
                //self.makeDecoration(cell3, 'KBase Community', panel3);

                var cell4 = $('<div panel panel-default">');
                self.$elem.append(cell4);
                var panel4 = self.makePleaseWaitPanel();
                self.makeDecoration(cell4, 'Taxonomy', panel4);

                var cell5 = $('<div panel panel-default">');
                self.$elem.append(cell5);
                var panel5 = self.makePleaseWaitPanel();
                self.makeDecoration(cell5, 'Assembly and Annotation', panel5);

                var objId = scope.ws + "/" + scope.id;
                if (self.options.ver)
                    objId += "/" + self.options.ver;
                var genome_fields = ["complete", "contig_ids", "contig_lengths", "contigset_ref", "dna_size",
                    "domain", "gc_content", "genetic_code", "id", "md5", "num_contigs",
                    "scientific_name", "source", "source_id", "tax_id", "taxonomy"];

                var ready = function (genomeInfo) {
                    panel1.empty();
                    try {
                        panel1.KBaseGenomeWideOverview({
                            genomeID: scope.id,
                            workspaceID: scope.ws,
                            genomeInfo: genomeInfo,
                            runtime: self.runtime
                        });
                    } catch (e) {
                        console.error(e);
                        self.showError(panel1, e.message);
                    }

                    var searchTerm = "";
                    if (genomeInfo && genomeInfo.data['scientific_name'])
                        searchTerm = genomeInfo.data['scientific_name'];
                    panel2.empty();
                    try {
                        panel2.KBaseLitWidget({
                            literature: searchTerm,
                            genomeInfo: genomeInfo,
                            runtime: self.runtime
                        });
                    } catch (e) {
                        console.error(e);
                        self.showError(panel2, e.message);
                    }

                    //panel3.empty();
                    //panel3.KBaseGenomeWideCommunity({genomeID: scope.id, workspaceID: scope.ws, kbCache: kb, 
                    //	genomeInfo: genomeInfo});

                    panel4.empty();
                    try {
                        panel4.KBaseGenomeWideTaxonomy({
                            genomeID: scope.id,
                            workspaceID: scope.ws,
                            genomeInfo: genomeInfo,
                            runtime: self.runtime
                        });
                    } catch (e) {
                        console.error(e);
                        self.showError(panel4, e.message);
                    }
                    if (genomeInfo && genomeInfo.data['domain'] === 'Eukaryota' ||
                        genomeInfo && genomeInfo.data['domain'] === 'Plant') {
                        cell5.empty();
                    } else {
                        var feature_fields = ["aliases",
                                              "annotations",
                                              "function",
                                              "id",
                                              "location",
                                              "protein_translation_length",
                                              "type"];

                        ga_api.get_genome_v1({"genomes": [{"ref": objId}],
                                              "included_fields": genome_fields,
                                              "included_feature_fields": feature_fields}).then(function (data) {
                            var genomeInfo = data.genomes[0];
                            var gnm = genomeInfo.data;
                            if (gnm.contig_ids && gnm.contig_lengths && gnm.contig_ids.length === gnm.contig_lengths.length) {
                                panel5.empty();
                                try {
                                    panel5.KBaseGenomeWideAssemAnnot({
                                        genomeID: scope.id,
                                        workspaceID: scope.ws,
                                        ver: scope.ver,
                                        genomeInfo: genomeInfo,
                                        runtime: self.runtime
                                    });
                                } catch (e) {
                                    console.error(e);
                                    self.showError(panel5, e.message);
                                }
                            } else {                                
                                var assembly_error = function (error) {
                                    console.error("Error loading contigset subdata");
                                    console.error(error);
                                    panel5.empty();
                                    self.showError(panel5, error);
                                };
                                
                                asm_api.get_contig_ids(gnm.contigset_ref).then(function (contig_ids) {
                                   gnm.contig_ids = contig_ids;
                                   return contig_ids;
                                }).catch(assembly_error(error));
                                asm_api.get_contig_lengths(gnm.contigset_ref).then(function (contig_lengths) {
                                    gnm.contig_lengths = contig_lengths;
                                    return contig_lengths;
                                }).catch(assembly_error(error));
                            }

                            return null;
                        });
                    }
                };
                
                ga_api.get_genome_v1({"genomes": [{"ref": objId}],
                                      "included_fields": genome_fields}).then(function (data) {
                    ready(data.genomes[0]);
                    return null;
                }).catch(function (error) {
                    console.error("Error loading genome subdata");
                    console.error(error);
                    panel1.empty();
                    self.showError(panel1, error);
                    cell2.empty();
                    cell3.empty();
                    cell4.empty();
                    cell5.empty();
                });
            },
            makePleaseWaitPanel: function () {
                return $('<div>').html(html.loading('loading...'));
            },
            makeDecoration: function ($panel, title, $widgetDiv) {
                var id = this.genUUID();
                $panel.append(
                    $('<div class="panel-group" id="accordion_' + id + '" role="tablist" aria-multiselectable="true">')
                    .append($('<div class="panel panel-default kb-widget">')
                        .append('' +
                            '<div class="panel-heading" role="tab" id="heading_' + id + '">' +
                            '<h4 class="panel-title">' +
                            '<span data-toggle="collapse" data-parent="#accordion_' + id + '" data-target="#collapse_' + id + '" aria-expanded="false" aria-controls="collapse_' + id + '" style="cursor:pointer;">' +
                            ' ' + title +
                            '</span>' +
                            '</h4>' +
                            '</div>'
                            )
                        .append($('<div id="collapse_' + id + '" class="panel-collapse collapse in" role="tabpanel" aria-labelledby="heading_' + id + '" area-expanded="true">')
                            .append($('<div class="panel-body">').append($widgetDiv))
                            )
                        )
                    );
            },
            getData: function () {
                return {
                    type: "Genome Page",
                    id: this.options.genomeID,
                    workspace: this.options.workspaceID,
                    title: "Genome Page"
                };
            },
            showError: function (panel, e) {
                panel.empty();
                panel.append("Error: " + JSON.stringify(e));
            },
            genUUID: function () {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
        });
    });