const Joi = require("joi");
const less = require("less");
const path = require("path");
const metalsmithPluginKit = require("metalsmith-plugin-kit");

var OPTIONS_SCHEMA = Joi.object().keys({
    pattern: Joi.alternatives()
        .try(Joi.string(), Joi.array().items(Joi.string()))
        .default("**/*.less"),
    removeSource: Joi.boolean().default(false),
    render: Joi.object(),
    useDynamicSourceMap: Joi.boolean().default(false)
});

module.exports = plugin;

function plugin(options) {
    var validation = OPTIONS_SCHEMA.validate(options || {});

    if (validation.error) throw validation.error;

    const useDynamicSourceMap = validation.value.useDynamicSourceMap;
    const removeSource = validation.value.removeSource;

    return metalsmithPluginKit.middleware({
        each: (filename, file, files, metalsmith) => {
            let renderOptions = validation.value.render;
            const destination = filename.replace(/less/g, "css");
            const mapFilename = path.basename(destination) + ".map";
            const mapDestination = path.join(
                path.dirname(destination),
                mapFilename
            );

            if (useDynamicSourceMap) {
                renderOptions = metalsmithPluginKit.clone(renderOptions);
                renderOptions.sourceMap = {
                    outputSourceFiles: true,
                    sourceMapURL: path.basename(destination) + ".map"
                };
            }

            return less
                .render(file.contents.toString(), renderOptions)
                .then((output) => {
                    files[destination] = {
                        contents: Buffer.from(output.css)
                    };

                    if (useDynamicSourceMap) {
                        const map = JSON.parse(output.map);
                        const mapInputIndex = map.sources.indexOf("input");

                        if (mapInputIndex) {
                            map.sources[mapInputIndex] = path.join(
                                metalsmith._source,
                                filename
                            );
                        }

                        files[mapDestination] = {
                            contents: Buffer.from(JSON.stringify(map))
                        };
                    }

                    if (removeSource) {
                        delete files[filename];
                    }
                });
        },
        match: validation.value.pattern
    });
}
